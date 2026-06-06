/**
 * Generic CSV download utility.
 * @param headers - Array of column header strings
 * @param rows - Array of row arrays (each row is an array of cell values)
 * @param filename - File name (without extension)
 */
export function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const escape = (val: string | number) => {
    const str = String(val ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(',')),
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
