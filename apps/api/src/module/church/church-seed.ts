import { EntityManager } from 'typeorm';
import { AccountCategoryEntity } from '@src/database/entities/account-category.entity';
import { CalendarEntity } from '@src/database/entities/calendar.entity';
import { DepartmentEntity } from '@src/database/entities/department.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MinistryEntity } from '@src/database/entities/ministry.entity';
import { MissionaryStageEntity } from '@src/database/entities/missionary-stage.entity';
import { OfferingCategoryEntity } from '@src/database/entities/offering-category.entity';
import { CareNoteTypeEntity } from '@src/database/entities/care-note-type.entity';
import { PositionEntity } from '@src/database/entities/position.entity';
import { ResidentStatusEntity } from '@src/database/entities/resident-status.entity';
import { SmallGroupEntity } from '@src/database/entities/small-group.entity';
import { TrainingCourseEntity, TrainingFormat } from '@src/database/entities/training-course.entity';
import { WorshipServiceEntity } from '@src/database/entities/worship-service.entity';

/**
 * 교회 생성 시 함께 만드는 기준정보 기본값.
 *
 * 이게 없으면 재적상태가 하나도 없어서 **교인 등록이 즉시 실패**한다
 * (member.service 가 기본 상태를 찾지 못해 404). 예전에는 마이그레이션이 기존 교회에 일괄 시드해서
 * 드러나지 않던 문제였다 (planning 00.6).
 *
 * 기본값은 키퍼스처치 기준(양성 파이프라인 중심)이며, 만든 뒤 설정 화면에서 자유롭게 편집할 수 있다.
 */

/**
 * 재적상태 = 양성 파이프라인 단계. systemKey 가 있는 항목은 코드가 참조하므로 삭제 불가.
 *
 * `stallsAfterDays` 는 이 단계에 그 이상 머무르면 담당자에게 "정체"로 보여줄 기준이다.
 * 아래 숫자는 출발점일 뿐 교회가 조정하는 값이다. 도착점(사역자·파송)과 이탈 상태
 * (이명·별세·익명)는 오래 머무르는 게 정상이라 null 로 둔다.
 * 장기결석은 그 자체가 이미 경보라 파이프라인 정체와 겹쳐 세지 않는다.
 */
const MEMBER_STATUSES: {
  name: string;
  sortOrder: number;
  systemKey?: string;
  countsInRoster: boolean;
  isActive?: boolean;
  stallsAfterDays?: number;
}[] = [
  { name: '방문', sortOrder: 0, countsInRoster: true, stallsAfterDays: 30 },
  { name: '새가족', sortOrder: 1, systemKey: 'new', countsInRoster: true, stallsAfterDays: 90 },
  { name: '정착', sortOrder: 2, countsInRoster: true, stallsAfterDays: 180 },
  { name: '훈련생', sortOrder: 3, systemKey: 'trainee', countsInRoster: true, stallsAfterDays: 365 },
  { name: '사역자', sortOrder: 4, systemKey: 'worker', countsInRoster: true },
  // 파송자는 현지에 있으므로 주일 출석 명단에서 제외한다.
  { name: '파송', sortOrder: 5, systemKey: 'commissioned', countsInRoster: false },
  { name: '장기결석', sortOrder: 6, countsInRoster: true },
  { name: '이명', sortOrder: 7, countsInRoster: false },
  { name: '별세', sortOrder: 8, countsInRoster: false },
  { name: '익명', sortOrder: 9, systemKey: 'anonymous', countsInRoster: false, isActive: false },
];

/**
 * 양육기록 종류. systemKey 가 있는 항목은 나중에 코드가 지목할 수 있게 남겨둔 것이고,
 * 이름·순서는 교회가 자유롭게 바꾼다.
 */
const CARE_NOTE_TYPES: { name: string; systemKey?: string }[] = [
  { name: '심방' },
  { name: '면담' },
  { name: '양육' },
  { name: '상담' },
  { name: '파송보고', systemKey: 'field_report' },
  // 기획행정팀이 공동체 간사에게 남기는 기록
  { name: '케어' },
  { name: '재훈련' },
  { name: '기타' },
];

/** 사역 역할 (구 직분). 청년 공동체라 장로·권사 대신 사역 중심으로 둔다. */
const POSITIONS = ['담임목사', '목사', '전도사', '간사', '팀장', '사역자'];

/**
 * 사역팀 — 이 교회의 핵심 조직 축이자 양성 인큐베이터.
 * 다윗의열쇠 공식 사이트(kodministry.com, 2026-10 확인)와 복음기도신문(2025-10) 기준.
 * 괄호 안은 실제 팀 브랜드: 예배(Keepers Worship) · 미디어(From Him) · 문화예술(KEPT, 드라마 워십) ·
 * 다음세대(The Keys) · 훈련(Boot Camp) · 해외선교(keyman) · 비즈니스(ADO, 의류 브랜드 포함).
 */
const MINISTRIES = ['예배팀', '미디어팀', '문화예술팀', '다음세대팀', '훈련팀', '해외선교팀', '비즈니스팀', '기획행정팀'];

/** 상설 기관 (연령 부서 아님). 다음세대 교육(더키즈)과 베이커리카페(ADO). */
const DEPARTMENTS = ['본부', '더키즈', '카페'];

/** 공동생활 공동체. 실제 하우스 이름으로 바꿔 쓰면 된다. */
const SMALL_GROUPS = ['1하우스', '2하우스'];

/** 공식 사이트의 예배 안내 기준. 수요·새벽 예배는 없고, 다음세대 예배와 교사 예배가 따로 있다. */
const WORSHIP_SERVICES = ['주일예배', '다음세대예배', '다음세대 교사예배', '금요기도회', '오픈예배'];

const OFFERING_CATEGORIES = ['십일조', '주정헌금', '감사헌금', '선교헌금', '건축헌금', '특별헌금'];

const ACCOUNT_CATEGORIES = ['인건비', '사역비', '운영비', '선교비', '시설비', '기타'];

/**
 * 선교사 단계 기본값. 파송 절차는 교회마다 달라 이름·개수를 자유롭게 바꿀 수 있고,
 * 코드가 아는 건 `countsAsActive`(현재 파송 중으로 집계할 단계인지) 하나뿐이다.
 */
const MISSIONARY_STAGES: { name: string; countsAsActive: boolean }[] = [
  { name: '후보', countsAsActive: false },
  { name: '훈련 중', countsAsActive: false },
  { name: '파송 확정', countsAsActive: true },
  { name: '현지 사역', countsAsActive: true },
  { name: '안식년', countsAsActive: true },
  { name: '복귀', countsAsActive: false },
  { name: '종료', countsAsActive: false },
];

/**
 * 간사 상태 기본값. 코드가 아는 건 `countsAsActive`(지금 공동체에 있는 사람으로 셀지) 하나뿐이다.
 * 안식 중인 간사도 공동체 식구라 집계에 넣는다.
 */
const RESIDENT_STATUSES: { name: string; countsAsActive: boolean }[] = [
  { name: '활동', countsAsActive: true },
  { name: '안식', countsAsActive: true },
  { name: '퇴소', countsAsActive: false },
];

/**
 * 훈련 과정 — 공식 사이트(kodministry.com/training)의 STEP 1~4.
 * STEP 5 "다윗의열쇠 선교사(종신 헌신)"는 과정이 아니라 도착점이라 간사·선교사 트랙이 맡는다.
 * `completionStatus` 는 수료 시 올리기를 제안할 재적상태 **이름**이다 — 위 MEMBER_STATUSES 에서 찾아 id 로 바꾼다.
 * 회차 수는 기수 개설 시 기본값으로 쓰인다. 합숙 과정은 기간이 길어 회차 1개로 두고 교회가 나눠 쓴다.
 */
const TRAINING_COURSES: {
  name: string;
  format: TrainingFormat;
  defaultSessionCount: number;
  description: string;
  step: number;
  completionStatus?: string;
  completionSuggestsResident?: boolean;
}[] = [
  {
    name: '믿음으로 길을 걷다',
    format: TrainingFormat.RETREAT,
    defaultSessionCount: 4,
    description: '3박 4일 수련회.',
    step: 1,
    completionStatus: '정착',
  },
  {
    name: '살아있는 믿음학교',
    format: TrainingFormat.WEEKLY,
    defaultSessionCount: 12,
    description: '12주간 매주 토요일 + 10일 아웃리치.',
    step: 2,
    completionStatus: '훈련생',
  },
  {
    name: '고생질',
    format: TrainingFormat.INTENSIVE,
    defaultSessionCount: 1,
    description: '3개월 합숙 훈련 (말씀 앞에서 고민·생각·질문).',
    step: 3,
    completionStatus: '사역자',
  },
  {
    name: '선교사학교',
    format: TrainingFormat.INTENSIVE,
    defaultSessionCount: 1,
    description: '6개월 인턴십. 선교사와 함께 생활하며 배운다.',
    step: 4,
    completionSuggestsResident: true,
  },
];

const CALENDARS: { name: string; color: string; sortOrder: number }[] = [
  { name: '전체 일정', color: 'oklch(0.62 0.19 260)', sortOrder: 0 },
  { name: '훈련', color: 'oklch(0.65 0.15 150)', sortOrder: 1 },
  { name: '선교', color: 'oklch(0.7 0.13 60)', sortOrder: 2 },
];

/** 연도별 기준정보(기관·사역팀·공동체)는 생성 시점의 연도로 시드한다. */
export async function seedChurchReferences(manager: EntityManager, churchId: number, year: number): Promise<void> {
  const statusRepo = manager.getRepository(MemberStatusEntity);
  const statuses = await statusRepo.save(
    MEMBER_STATUSES.map(status =>
      statusRepo.create({
        churchId,
        name: status.name,
        sortOrder: status.sortOrder,
        systemKey: status.systemKey,
        countsInRoster: status.countsInRoster,
        isActive: status.isActive ?? true,
        stallsAfterDays: status.stallsAfterDays ?? null,
      })
    )
  );

  const careNoteTypeRepo = manager.getRepository(CareNoteTypeEntity);
  await careNoteTypeRepo.save(
    CARE_NOTE_TYPES.map((type, index) =>
      careNoteTypeRepo.create({ churchId, name: type.name, sortOrder: index, systemKey: type.systemKey ?? null })
    )
  );

  const positionRepo = manager.getRepository(PositionEntity);
  await positionRepo.save(POSITIONS.map((name, index) => positionRepo.create({ churchId, name, sortOrder: index })));

  const ministryRepo = manager.getRepository(MinistryEntity);
  await ministryRepo.save(MINISTRIES.map((name, index) => ministryRepo.create({ churchId, year, name, sortOrder: index })));

  const departmentRepo = manager.getRepository(DepartmentEntity);
  await departmentRepo.save(DEPARTMENTS.map((name, index) => departmentRepo.create({ churchId, year, name, sortOrder: index })));

  const smallGroupRepo = manager.getRepository(SmallGroupEntity);
  await smallGroupRepo.save(SMALL_GROUPS.map((name, index) => smallGroupRepo.create({ churchId, year, name, sortOrder: index })));

  const worshipRepo = manager.getRepository(WorshipServiceEntity);
  await worshipRepo.save(WORSHIP_SERVICES.map((name, index) => worshipRepo.create({ churchId, name, sortOrder: index })));

  const offeringRepo = manager.getRepository(OfferingCategoryEntity);
  await offeringRepo.save(OFFERING_CATEGORIES.map((name, index) => offeringRepo.create({ churchId, name, sortOrder: index })));

  const accountRepo = manager.getRepository(AccountCategoryEntity);
  await accountRepo.save(ACCOUNT_CATEGORIES.map((name, index) => accountRepo.create({ churchId, name, sortOrder: index })));

  const courseRepo = manager.getRepository(TrainingCourseEntity);
  const statusIdByName = new Map(statuses.map(status => [status.name, status.id]));
  await courseRepo.save(
    TRAINING_COURSES.map(({ completionStatus, ...course }, index) =>
      courseRepo.create({
        churchId,
        ...course,
        completionStatusId: completionStatus ? (statusIdByName.get(completionStatus) ?? null) : null,
        completionSuggestsResident: course.completionSuggestsResident ?? false,
        sortOrder: index,
      })
    )
  );

  const stageRepo = manager.getRepository(MissionaryStageEntity);
  await stageRepo.save(MISSIONARY_STAGES.map((stage, index) => stageRepo.create({ churchId, ...stage, sortOrder: index })));

  const residentStatusRepo = manager.getRepository(ResidentStatusEntity);
  await residentStatusRepo.save(
    RESIDENT_STATUSES.map((status, index) => residentStatusRepo.create({ churchId, ...status, sortOrder: index }))
  );

  const calendarRepo = manager.getRepository(CalendarEntity);
  await calendarRepo.save(CALENDARS.map(calendar => calendarRepo.create({ churchId, ...calendar })));
}
