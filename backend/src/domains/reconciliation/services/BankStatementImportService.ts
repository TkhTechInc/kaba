import { Injectable } from '@nestjs/common';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { LedgerEntry } from '@/domains/ledger/models/LedgerEntry';
import {
  parseBankStatementCSV,
  type ParsedRow,
  type DateFormatHint,
} from '../parsers/bank-statement-csv-parser';

const BANK_IMPORT_CATEGORY = 'Bank Import';

export interface PreviewResult {
  rows: ParsedRow[];
  errors: string[];
}

export interface ImportResult {
  created: number;
  entries: LedgerEntry[];
}

@Injectable()
export class BankStatementImportService {
  constructor(private readonly ledgerService: LedgerService) {}

  async parseAndPreview(
    csvText: string,
    currency: string,
    dateFormat?: DateFormatHint,
  ): Promise<PreviewResult> {
    const { rows, errors } = parseBankStatementCSV(csvText, dateFormat);
    return { rows, errors };
  }

  async importAndCreate(
    businessId: string,
    csvText: string,
    currency: string,
    userId?: string,
    dateFormat?: DateFormatHint,
  ): Promise<ImportResult> {
    const { rows, errors } = parseBankStatementCSV(csvText, dateFormat);
    if (errors.length > 0) {
      throw new Error(`CSV parse errors: ${errors.join('; ')}`);
    }

    const entries: LedgerEntry[] = [];
    for (const row of rows) {
      const entry = await this.ledgerService.createEntry(
        {
          businessId,
          type: row.type,
          amount: row.amount,
          currency,
          description: row.description,
          category: BANK_IMPORT_CATEGORY,
          date: row.date,
        },
        userId,
      );
      entries.push(entry);
    }

    return { created: entries.length, entries };
  }
}
