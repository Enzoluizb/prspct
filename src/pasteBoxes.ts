// Ao colar do Word, o texto puro perde as tabelas de UMA célula só (caixas com
// borda, tipo CONTRATADA/CONTRATANTE): elas viram linhas soltas, iguais a texto
// normal. Mas a área de transferência também traz o HTML do Word, onde essas
// tabelas existem de verdade. Aqui usamos o HTML só pra DESCOBRIR quais
// trechos são caixa e marcamos esses trechos no texto puro (o resto do texto
// colado continua exatamente como veio).
import { BOX_END, BOX_START } from './formatter';

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

// Lê o HTML colado e devolve, pra cada tabela de 1 linha x 1 célula, as linhas
// de texto dela. (Só roda no navegador: usa DOMParser.)
export function extractSingleCellBoxes(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const boxes: string[][] = [];
  doc.querySelectorAll('table').forEach((table) => {
    const rows = table.querySelectorAll('tr');
    if (rows.length !== 1) return;
    const cells = rows[0].querySelectorAll('td, th');
    if (cells.length !== 1) return;
    if (cells[0].querySelector('table')) return; // tabela dentro de tabela: ignora

    const cell = cells[0].cloneNode(true) as HTMLElement;
    cell.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    cell.querySelectorAll('p, div, li').forEach((el) => el.append('\n'));
    const lines = (cell.textContent ?? '')
      .split('\n')
      .map(normalizeLine)
      .filter((l) => l.length > 0);
    if (lines.length > 0) boxes.push(lines);
  });
  return boxes;
}

// Procura cada caixa dentro do texto puro (linha a linha, ignorando linhas em
// branco e espaços) e põe BOX_START/BOX_END em volta. Caixa que não for achada
// é ignorada, sem erro.
export function wrapBoxes(plainText: string, boxes: string[][]): string {
  const lines = plainText.replace(/\r\n/g, '\n').split('\n');
  const norm = lines.map(normalizeLine);
  const nonBlank: number[] = [];
  norm.forEach((l, i) => {
    if (l) nonBlank.push(i);
  });

  // Compara o conteúdo SEM espaços nem quebras de linha: o HTML do Word costuma
  // quebrar um parágrafo longo em várias linhas, que no texto puro vem numa só.
  const squash = (s: string) => s.replace(/\s+/g, '');

  const ranges: { start: number; end: number }[] = [];
  let from = 0; // as caixas aparecem em ordem no documento
  for (const box of boxes) {
    const key = squash(box.join(''));
    if (!key) continue;
    let found = false;
    for (let s = from; s < nonBlank.length && !found; s++) {
      let acc = '';
      for (let e = s; e < nonBlank.length; e++) {
        acc += squash(norm[nonBlank[e]]);
        if (acc.length > key.length || !key.startsWith(acc)) break;
        if (acc.length === key.length) {
          ranges.push({ start: nonBlank[s], end: nonBlank[e] });
          from = e + 1;
          found = true;
          break;
        }
      }
    }
  }
  if (ranges.length === 0) return plainText;

  const out: string[] = [];
  lines.forEach((line, i) => {
    for (const r of ranges) if (r.start === i) out.push(BOX_START);
    out.push(line);
    for (const r of ranges) if (r.end === i) out.push(BOX_END);
  });
  return out.join('\n');
}
