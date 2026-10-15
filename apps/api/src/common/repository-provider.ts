import { Injectable } from '@nestjs/common';
import { TransactionService } from '@src/database/transaction.service';

@Injectable()
export class RepositoryProvider {
  constructor(private transaction: TransactionService) {}
}
