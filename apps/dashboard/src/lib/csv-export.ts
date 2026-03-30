/**
 * Generic CSV export utility.
 * Handles special characters, commas, quotes, and date formatting.
 */

export interface CsvColumn<T> {
  /** Header label shown in the CSV */
  header: string
  /** Accessor function to pull the cell value from a row */
  accessor: (row: T) => string | number | boolean | null | undefined
}

function escapeCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  // If the value contains a comma, quote, or newline, wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert an array of objects into CSV text using the provided column definitions.
 */
export function toCsvString<T>(data: T[], columns: CsvColumn<T>[]): string {
  const headerRow = columns.map((c) => escapeCell(c.header)).join(',')
  const bodyRows = data.map((row) =>
    columns.map((c) => escapeCell(c.accessor(row))).join(','),
  )
  return [headerRow, ...bodyRows].join('\n')
}

/**
 * Trigger a browser download of CSV data.
 *
 * @param data     Array of row objects
 * @param columns  Column definitions (header + accessor)
 * @param filename File name for the download (without extension is fine, .csv will be appended if missing)
 */
export function exportToCsv<T>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  const csv = toCsvString(data, columns)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM for Excel
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Format an ISO date string for CSV output.
 */
export function csvDate(isoStr: string | null | undefined): string {
  if (!isoStr) return ''
  try {
    return new Date(isoStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return isoStr
  }
}

/**
 * Format cents to dollar string for CSV.
 */
export function csvDollars(cents: number | null | undefined): string {
  if (cents == null) return ''
  return (cents / 100).toFixed(2)
}
