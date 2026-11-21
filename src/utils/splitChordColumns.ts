/**
 * Divide o HTML de uma cifra (linhas separadas por "\n", dentro de <pre>) em colunas de até
 * `linesPerColumn` linhas. Uma linha de acordes no fim de uma coluna vai para a próxima,
 * para não ficar separada da letra.
 *
 * Cada coluna fecha/reabre o <pre>, como o HTML original faz.
 */
export function splitChordColumns(html: string | undefined, linesPerColumn: number, maxColumns = 8): string[] {
  if (!html) return [];
  const lines = html.split('\n');
  const per = Math.max(4, Math.floor(linesPerColumn));
  if (!Number.isFinite(per) || lines.length <= per) return [html];

  const cols: string[][] = [];
  for (let i = 0; i < lines.length;) {
    const end = cols.length === maxColumns - 1 ? lines.length : i + per;
    cols.push(lines.slice(i, end));
    i = end;
  }

  for (let c = 0; c < cols.length - 1; c++) {
    const col = cols[c];
    if (col.length > 1 && col[col.length - 1].includes('<b')) cols[c + 1].unshift(col.pop()!);
  }

  return cols
    .filter((col) => col.length > 0)
    .map((col, c, all) => (c > 0 ? '<pre>\n' : '') + col.join('\n') + (c < all.length - 1 ? '\n</pre>' : ''));
}

/** Quantidade de linhas visíveis do HTML (para decidir onde a prévia da próxima música entra). */
export function countLines(html: string | undefined): number {
  return html ? html.split('\n').length : 0;
}
