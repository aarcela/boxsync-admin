import { createHash } from 'crypto';

export const HQ_IMPORT_MAX_ROWS = 500;
export const HQ_IMPORT_MAX_BYTES = 1_000_000;
export const HQ_IMPORT_JOB_TTL_MS = 30 * 60 * 1000;

export type CsvRecord = {
  line: number;
  values: Record<string, string>;
};

export type ParsedCsv = {
  headers: string[];
  rows: CsvRecord[];
};

function detectDelimiter(headerLine: string): string {
  const counts: Array<[string, number]> = [
    [',', (headerLine.match(/,/g) ?? []).length],
    [';', (headerLine.match(/;/g) ?? []).length],
    ['\t', (headerLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

export function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

export function parseCsv(text: string): ParsedCsv {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const headerIndex = lines.findIndex((line) => line.trim().length > 0);
  if (headerIndex < 0) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(lines[headerIndex]);
  const headers = parseCsvLine(lines[headerIndex], delimiter).map(normalizeHeader);

  const rows: CsvRecord[] = [];
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const cells = parseCsvLine(raw, delimiter);
    const values: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      values[header] = (cells[idx] ?? '').trim();
    });
    const hasValue = Object.values(values).some((value) => value.length > 0);
    if (!hasValue) continue;
    rows.push({ line: i + 1, values });
  }

  return { headers, rows };
}

export function sha256Utf8(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
