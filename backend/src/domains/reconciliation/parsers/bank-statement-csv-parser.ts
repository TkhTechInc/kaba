/**
 * CSV parser for bank statement imports.
 * Handles: comma separator, optional BOM, flexible column mapping.
 * Date formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
 */

export type ParsedRow = {
  date: string;
  description: string;
  amount: number;
  type: 'sale' | 'expense';
};

export type DateFormatHint = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

/** Column name patterns (case-insensitive) */
const DATE_COLUMNS = ['date', 'transaction date', 'value date', 'posting date', 'trans date'];
const DESCRIPTION_COLUMNS = ['description', 'narration', 'particulars', 'details', 'memo', 'reference'];
const DEBIT_COLUMNS = ['debit', 'withdrawal', 'out', 'dr'];
const CREDIT_COLUMNS = ['credit', 'deposit', 'in', 'cr'];
const AMOUNT_COLUMNS = ['amount', 'transaction amount', 'value'];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findColumnIndex(headers: string[], patterns: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const n = normalizeHeader(headers[i]);
    if (patterns.some((p) => n.includes(p) || n === p)) return i;
  }
  return -1;
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      current += c;
    } else if (c === ',') {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse date string to YYYY-MM-DD.
 */
function parseDateToISO(
  raw: string,
  hint?: DateFormatHint,
): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Try YYYY-MM-DD first
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // DD/MM/YYYY, MM/DD/YYYY, or DD-MM-YYYY
  const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const [, g1, g2, y] = slashMatch;
    const a = g1!.padStart(2, '0');
    const b = g2!.padStart(2, '0');
    if (hint === 'MM/DD/YYYY') {
      return `${y}-${a}-${b}`; // g1=month, g2=day
    }
    return `${y}-${b}-${a}`; // default DD/MM: g1=day, g2=month
  }

  return null;
}

/**
 * Parse amount from string (handles 1,234.56 or 1234.56 or -123.45).
 */
function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/,/g, '');
  const m = s.match(/^-?[\d.]+$/);
  if (!m) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
}

export function parseBankStatementCSV(
  csvText: string,
  dateFormat?: DateFormatHint,
): ParseResult {
  const errors: string[] = [];
  const rows: ParsedRow[] = [];

  let text = csvText.trim();
  if (text.startsWith('\ufeff')) text = text.slice(1);

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    errors.push('CSV must have at least a header row and one data row');
    return { rows, errors };
  }

  const headerLine = lines[0]!;
  const headers = parseCSVLine(headerLine);

  const dateIdx = findColumnIndex(headers, DATE_COLUMNS);
  const descIdx = findColumnIndex(headers, DESCRIPTION_COLUMNS);
  const debitIdx = findColumnIndex(headers, DEBIT_COLUMNS);
  const creditIdx = findColumnIndex(headers, CREDIT_COLUMNS);
  const amountIdx = findColumnIndex(headers, AMOUNT_COLUMNS);

  if (dateIdx < 0) errors.push('No date column found (looked for: Date, Transaction Date, Value Date)');
  if (descIdx < 0) errors.push('No description column found (looked for: Description, Narration, Particulars)');
  if (debitIdx < 0 && creditIdx < 0 && amountIdx < 0) {
    errors.push('No amount column found (looked for: Debit, Credit, Amount)');
  }

  if (errors.length > 0) return { rows, errors };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const cells = parseCSVLine(line);
    const rowNum = i + 1;

    const dateRaw = dateIdx >= 0 ? cells[dateIdx] ?? '' : '';
    const descRaw = descIdx >= 0 ? cells[descIdx] ?? '' : '';
    const debitRaw = debitIdx >= 0 ? cells[debitIdx] ?? '' : '';
    const creditRaw = creditIdx >= 0 ? cells[creditIdx] ?? '' : '';
    const amountRaw = amountIdx >= 0 ? cells[amountIdx] ?? '' : '';

    const date = parseDateToISO(dateRaw, dateFormat);
    if (!date) {
      errors.push(`Row ${rowNum}: Invalid or missing date "${dateRaw}"`);
      continue;
    }

    const description = descRaw.trim() || 'Bank transaction';

    let amount: number;
    let type: 'sale' | 'expense';

    if (debitIdx >= 0 || creditIdx >= 0) {
      const debitVal = parseAmount(debitRaw);
      const creditVal = parseAmount(creditRaw);
      if (debitVal !== null && debitVal > 0) {
        amount = debitVal;
        type = 'expense';
      } else if (creditVal !== null && creditVal > 0) {
        amount = creditVal;
        type = 'sale';
      } else {
        errors.push(`Row ${rowNum}: No valid debit or credit amount`);
        continue;
      }
    } else {
      const amt = parseAmount(amountRaw);
      if (amt === null) {
        errors.push(`Row ${rowNum}: Invalid amount "${amountRaw}"`);
        continue;
      }
      amount = Math.abs(amt);
      type = amt >= 0 ? 'sale' : 'expense';
    }

    if (amount <= 0) {
      errors.push(`Row ${rowNum}: Amount must be positive`);
      continue;
    }

    rows.push({ date, description, amount, type });
  }

  return { rows, errors };
}
