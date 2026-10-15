import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PRETENDARD_BOLD, PRETENDARD_REGULAR } from '@src/assets/asset-path';
import { DataSources } from '@src/database/data-sources';
import { ChurchEntity } from '@src/database/entities/church.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { OfferingService } from './offering.service';

@Injectable()
export class ReceiptService {
  constructor(private readonly offerings: OfferingService) {}

  /** 기부금영수증 PDF Buffer 생성 (연말정산용, calendar-year 기준). */
  async generate(churchId: number, memberId: number, year: number): Promise<{ buffer: Buffer; filename: string }> {
    const church = await DataSources.instance.getRepository(ChurchEntity).findOne({ where: { id: churchId } });
    if (!church) throw new NotFoundException('교회를 찾을 수 없습니다.');

    const member = await DataSources.instance.getRepository(MemberEntity).findOne({ where: { id: memberId, churchId } });
    if (!member) throw new NotFoundException('성도를 찾을 수 없습니다.');
    const status = await DataSources.instance.getRepository(MemberStatusEntity).findOne({ where: { id: member.statusId, churchId } });
    if (status?.systemKey === 'anonymous') {
      throw new BadRequestException('익명 성도는 영수증을 발급할 수 없습니다.');
    }

    const summary = await this.offerings.memberAnnualSummary(churchId, memberId, year);
    if (summary.total === 0) {
      throw new BadRequestException(`${year}년 발급할 헌금 내역이 없습니다.`);
    }

    const buffer = await this.render(church, member, year, summary);
    const filename = `donation-receipt-${member.name}-${year}.pdf`;
    return { buffer, filename };
  }

  private render(
    church: ChurchEntity,
    member: MemberEntity,
    year: number,
    summary: { total: number; byCategory: { categoryName: string | null; amount: number }[] }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 56 });
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('kr', PRETENDARD_REGULAR);
      doc.registerFont('krb', PRETENDARD_BOLD);

      const won = (n: number) => `₩ ${n.toLocaleString('ko-KR')}`;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // 제목
      doc.font('krb').fontSize(22).text('기부금 영수증', { align: 'center' });
      doc.moveDown(0.3);
      doc.font('kr').fontSize(10).fillColor('#666').text(`${year}년 귀속 · 소득공제용`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1.5);

      // 발행 교회 (기부금 수령 단체)
      this.sectionTitle(doc, '① 기부금 수령 단체');
      this.row(doc, '단체명', church.name);
      this.row(doc, '고유번호 / 사업자등록번호', church.registrationNumber ?? '—');
      this.row(doc, '대표자', church.representative ?? '—');
      this.row(doc, '소재지', church.address ?? '—');
      doc.moveDown(1);

      // 기부자
      this.sectionTitle(doc, '② 기부자');
      this.row(doc, '성명', member.name);
      this.row(doc, '주소', member.address ?? '—');
      this.row(doc, '연락처', member.phone ?? '—');
      doc.moveDown(1);

      // 기부 내역
      this.sectionTitle(doc, `③ 기부 내역 (과세기간 ${year}.01.01 ~ ${year}.12.31)`);
      doc.moveDown(0.3);

      const labelX = doc.page.margins.left;
      const amountW = 160;
      const amountX = doc.page.margins.left + pageWidth - amountW;

      // 표 헤더
      const headerY = doc.y;
      doc.rect(labelX, headerY, pageWidth, 24).fill('#f2f2f2');
      doc.fillColor('#000').font('krb').fontSize(11);
      doc.text('헌금 종류', labelX + 10, headerY + 6);
      doc.text('금액', amountX, headerY + 6, { width: amountW - 10, align: 'right' });
      doc.y = headerY + 24;

      // 표 행
      doc.font('kr').fontSize(11);
      for (const category of summary.byCategory) {
        const rowY = doc.y;
        doc.text(category.categoryName ?? '기타', labelX + 10, rowY + 6);
        doc.text(won(category.amount), amountX, rowY + 6, { width: amountW - 10, align: 'right' });
        doc
          .moveTo(labelX, rowY + 24)
          .lineTo(labelX + pageWidth, rowY + 24)
          .strokeColor('#e0e0e0')
          .stroke();
        doc.y = rowY + 24;
      }

      // 합계
      const totalY = doc.y;
      doc.rect(labelX, totalY, pageWidth, 28).fill('#1a1a1a');
      doc.fillColor('#fff').font('krb').fontSize(12);
      doc.text('합계', labelX + 10, totalY + 8);
      doc.text(won(summary.total), amountX, totalY + 8, { width: amountW - 10, align: 'right' });
      doc.y = totalY + 28;
      doc.fillColor('#000');

      doc.moveDown(2);
      doc.font('kr').fontSize(9).fillColor('#666');
      doc.text('위와 같이 기부금을 수령하였음을 증명합니다.', { align: 'center' });
      doc.moveDown(0.5);
      const issued = new Date();
      doc.text(`발급일: ${issued.getFullYear()}년 ${issued.getMonth() + 1}월 ${issued.getDate()}일`, { align: 'center' });
      doc.moveDown(0.5);
      doc.font('krb').fontSize(11).fillColor('#000').text(church.name, { align: 'center' });

      doc.end();
    });
  }

  private sectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.font('krb').fontSize(12).fillColor('#000').text(title);
    doc.moveDown(0.3);
  }

  private row(doc: PDFKit.PDFDocument, label: string, value: string) {
    const x = doc.page.margins.left;
    const y = doc.y;
    doc.font('kr').fontSize(10).fillColor('#888').text(label, x, y, { width: 180 });
    doc
      .fillColor('#000')
      .fontSize(11)
      .text(value, x + 180, y, { width: 300 });
    doc.moveDown(0.4);
  }
}
