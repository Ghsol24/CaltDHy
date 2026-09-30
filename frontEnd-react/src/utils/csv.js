// Quoting contains separators/newlines; the apostrophe keeps formula-like text
// literal when a financial report is opened in a spreadsheet application.
export function csvCell(value) {
  let text = String(value ?? '');
  // eslint-disable-next-line no-control-regex -- Spreadsheet importers can ignore leading control bytes.
  const formulaLike = /^[\s\u0000-\u001f]*[=+\-@＝＋－＠]/u.test(text);
  // A strict decimal/percentage cannot contain an expression. Preserve numeric
  // financial columns, including negative changes, for spreadsheet calculations.
  const numericText = /^-?\d+(?:\.\d+)?%?$/u.test(text);
  if (typeof value !== 'number' && typeof value !== 'bigint' &&
      !numericText && (/^[\t\r\n]/u.test(text) || formulaLike)) {
    text = "'" + text;
  }
  return '"' + text.replace(/"/g, '""') + '"';
}

export function csvRow(values) {
  return values.map(csvCell).join(',') + '\n';
}
