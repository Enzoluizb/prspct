// Ao colar do Word, o texto puro perde informação das tabelas:
//  - tabela de UMA célula só (caixa com borda, tipo CONTRATADA/CONTRATANTE) vira
//    linhas soltas, iguais a texto normal;
//  - célula com VÁRIAS linhas (ex: "2ªs. a 6ªs." + "das 8:30 às 18:00hs.") quebra
//    a linha da tabela no meio.
// Mas a área de transferência também traz o HTML do Word, onde as tabelas
// existem de verdade. Aqui usamos o HTML pra reconstruir cada tabela e trocar o
// trecho correspondente do texto puro (o resto do texto colado continua
// exatamente como veio):
//  - caixa  -> trecho entre BOX_START / BOX_END
//  - tabela -> uma linha por linha da tabela, células separadas por tab
import { BOX_END, BOX_START } from './formatter';

export type PastedTable =
  | { kind: 'box'; lines: string[] }
  | { kind: 'grid'; rows: string[][] };

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function cellText(cell: Element): string[] {
  const clone = cell.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  clone.querySelectorAll('p, div, li').forEach((el) => el.append('\n'));
  return (clone.textContent ?? '')
    .split('\n')
    .map(normalizeLine)
    .filter((l) => l.length > 0);
}

// Lê o HTML colado e devolve as tabelas na ordem do documento. (Só roda no
// navegador: usa DOMParser.)
export function extractTables(html: string): PastedTable[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tables: PastedTable[] = [];
  doc.querySelectorAll('table').forEach((table) => {
    if (table.querySelector('table')) return; // tabela que contém tabela: ignora

    const rows = Array.from(table.querySelectorAll('tr'));
    const grid = rows
      .map((tr) => Array.from(tr.querySelectorAll('td, th')).map((cell) => cellText(cell)))
      .filter((cells) => cells.length > 0);
    if (grid.length === 0) return;

    if (grid.length === 1 && grid[0].length === 1) {
      if (grid[0][0].length > 0) tables.push({ kind: 'box', lines: grid[0][0] });
      return;
    }

    const textRows = grid.map((cells) => cells.map((lines) => lines.join(' ')));
    if (textRows.every((cells) => cells.every((c) => c === ''))) return;
    tables.push({ kind: 'grid', rows: textRows });
  });
  return tables;
}

const squash = (s: string) => s.replace(/\s+/g, '');

function tableKey(t: PastedTable): string {
  return squash(t.kind === 'box' ? t.lines.join('') : t.rows.map((r) => r.join('')).join(''));
}

// Procura cada tabela dentro do texto puro (linha a linha, ignorando linhas em
// branco, espaços e tabs) e troca/marca o trecho. Tabela que não for achada é
// ignorada, sem erro.
export function applyTables(plainText: string, tables: PastedTable[]): string {
  const lines = plainText.replace(/\r\n/g, '\n').split('\n');
  const norm = lines.map(normalizeLine);
  const nonBlank: number[] = [];
  norm.forEach((l, i) => {
    if (l) nonBlank.push(i);
  });

  // Compara o conteúdo SEM espaços nem quebras de linha: o HTML do Word costuma
  // quebrar um parágrafo longo em várias linhas, que no texto puro vem numa só.
  const found: { start: number; end: number; table: PastedTable }[] = [];
  let from = 0; // as tabelas aparecem em ordem no documento
  for (const table of tables) {
    const key = tableKey(table);
    if (!key) continue;
    let ok = false;
    for (let s = from; s < nonBlank.length && !ok; s++) {
      let acc = '';
      for (let e = s; e < nonBlank.length; e++) {
        acc += squash(norm[nonBlank[e]]);
        if (acc.length > key.length || !key.startsWith(acc)) break;
        if (acc.length === key.length) {
          found.push({ start: nonBlank[s], end: nonBlank[e], table });
          from = e + 1;
          ok = true;
          break;
        }
      }
    }
  }
  if (found.length === 0) return plainText;

  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const hit = found.find((f) => f.start === i);
    if (!hit) {
      out.push(lines[i]);
      i++;
      continue;
    }
    if (hit.table.kind === 'box') {
      out.push(BOX_START, ...lines.slice(hit.start, hit.end + 1), BOX_END);
    } else {
      out.push(...hit.table.rows.map((cells) => cells.join('\t')));
    }
    i = hit.end + 1;
  }
  return out.join('\n');
}

// Atalho só pra caixas (mantido pros testes).
export function wrapBoxes(plainText: string, boxes: string[][]): string {
  return applyTables(
    plainText,
    boxes.map((lines) => ({ kind: 'box' as const, lines })),
  );
}
