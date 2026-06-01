function parseDateValue(value) {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return formatLocalDate(value)
  }

  if (typeof value === 'number' && value > 30000 && value < 60000) {
    const excelEpoch = new Date(1900, 0, 1)
    const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000)
    return Number.isNaN(date.getTime()) ? null : formatLocalDate(date)
  }

  let dateStr = String(value).trim()
  if (!dateStr) return null
  dateStr = dateStr.split('T')[0].split(' ')[0].trim().replace(/\//g, '-')

  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
  }

  const mdyMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`
  }

  const dmyMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/)
  if (dmyMatch) {
    const year = Number(dmyMatch[3])
    const fullYear = year < 50 ? 2000 + year : 1900 + year
    return `${fullYear}-${dmyMatch[1].padStart(2, '0')}-${dmyMatch[2].padStart(2, '0')}`
  }

  const parsed = new Date(dateStr)
  return Number.isNaN(parsed.getTime()) ? null : formatLocalDate(parsed)
}
export { parseDateValue };