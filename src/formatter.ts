import type { RulesConfig } from './mappings';

export interface FormatResult {
  html: string;
  unmappedFields: string[]; // rotulos encontrados no texto que nao tem coringa cadastrado
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalize(label: string): string {
  return label.trim().toLowerCase();
}

// Titulo de secao: linha curta, so texto (sem ":" no meio), toda maiuscula.
// Um ":" sozinho no final (ex: "LOCATÁRIO(A):") nao desqualifica.
function isHeadingLine(line: string): boolean {
  let t = line.trim();
  if (!t) return false;
  if (t.endsWith(':')) t = t.slice(0, -1).trim();
  if (!t || t.includes(':')) return false;
  if (t.length > 60) return false;
  const hasLetter = /[A-Za-zÀ-ÿ]/.test(t);
  const hasLowercase = /[a-zà-ÿ]/.test(t);
  return hasLetter && !hasLowercase;
}

// Um ou mais campos "Rótulo: valor" na mesma linha, ex:
// "CPF:  000.000.000-00     RG: 99 99 999-99" -> dois campos.
// Um novo rótulo só é reconhecido no início da linha ou depois de 2+ espaços
// (é assim que campos ficam lado a lado quando colados do Word).
const FIELD_LABEL_REGEX = /(?:^|(?<= {2,}))([A-ZÀ-Ÿ][A-Za-zÀ-ÿ0-9°º/.() -]{0,40}?):[ \t]?/g;

interface FieldMatch {
  label: string;
  labelStart: number;
  valueStart: number;
}

function findFieldsInLine(line: string): FieldMatch[] {
  const matches: FieldMatch[] = [];
  for (const m of line.matchAll(FIELD_LABEL_REGEX)) {
    matches.push({ label: m[1], labelStart: m.index ?? 0, valueStart: (m.index ?? 0) + m[0].length });
  }
  return matches;
}

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Primeira "palavra" do nome do grupo (ex: "Locatário" em "Locatário (cliente)"),
// usada só pra tentar casar com o título de seção mais próximo (ver findCoringa).
function groupKeyword(group: string): string {
  const match = stripAccents(group).toLowerCase().match(/[a-z]+/);
  return match ? match[0] : '';
}

// Quando o mesmo rótulo (ex: "E-mail", "CEP") está cadastrado em mais de um grupo,
// usa o título de seção mais próximo ACIMA do campo (qualquer texto, não precisa
// seguir um padrão fixo) pra escolher o coringa certo: prefere o grupo cuja
// primeira palavra apareça dentro desse título. Se não achar pista nenhuma, usa
// o primeiro cadastrado (funciona bem quando o rótulo só existe em um grupo).
function findCoringa(config: RulesConfig, label: string, headingHint: string): string | undefined {
  const target = normalize(label);
  const candidates = config.coringas.filter((r) => normalize(r.label) === target);
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0].coringa;

  const hint = stripAccents(headingHint).toLowerCase();
  const byHint = candidates.find((r) => {
    const kw = groupKeyword(r.group);
    return kw && hint.includes(kw);
  });
  return (byHint ?? candidates[0]).coringa;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Aplica a lista de "negritar sempre" + as trocas dinamicas (valor literal -> coringa,
// detectadas nos campos "Rótulo: valor" e propagadas pro resto do texto) num pedaço
// de texto livre (que ainda NAO foi escapado pra HTML).
// - Trocas dinâmicas (dynamicSubs) ignoram maiúsculas/minúsculas de propósito
//   (ex: cadastra "Guarde Safe Self Storage" e também pega "GUARDE SAFE SELF
//   STORAGE" em caixa alta no meio das cláusulas).
// - "Negritar sempre" (boldWords) é EXATO: cadastrar "BOX" não deve negritar
//   "Box" nem o "Box" dentro de "Boxes" — só a palavra exatamente como foi
//   cadastrada.
function applyBoldAndSubstitutions(text: string, boldWords: string[], dynamicSubs: Map<string, string>): string {
  // termo mais longo primeiro, pra um termo curto não "comer" parte de um termo longo
  const terms = [
    ...Array.from(dynamicSubs.entries()).map(([t, replacement]) => ({ text: t, replacement, caseSensitive: false })),
    ...boldWords
      .filter((w) => w.trim())
      .map((w) => ({ text: w, replacement: null as string | null, caseSensitive: true })),
  ]
    .filter((t) => t.text)
    .sort((a, b) => b.text.length - a.text.length);

  if (terms.length === 0) return escapeHtml(text);

  const regex = new RegExp(terms.map((t) => escapeRegExp(t.text)).join('|'), 'gi');

  let result = '';
  let lastIndex = 0;
  for (const m of text.matchAll(regex)) {
    const matched = m[0];
    const term = terms.find((t) => t.text.toLowerCase() === matched.toLowerCase());
    const applies = term !== undefined && (!term.caseSensitive || term.text === matched);
    result += escapeHtml(text.slice(lastIndex, m.index ?? 0));
    if (applies) {
      const shown = term!.replacement ?? matched;
      result += `<strong>${escapeHtml(shown)}</strong>`;
    } else {
      result += escapeHtml(matched);
    }
    lastIndex = (m.index ?? 0) + matched.length;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

// Linha numerada (ex: "3." ou "3.1."): bota o número em negrito e, se o
// resto for um título todo em caixa alta (ex: "3. OBJETO DA LOCAÇÃO"), nega
// a linha inteira — do contrário é um parágrafo normal (ex: "3.1. O objeto
// do presente...") e só o número fica em negrito. Nunca centraliza: cláusula
// numerada sempre segue o fluxo normal do texto, igual no Word original.
function renderNumberedOrPlain(raw: string, boldWords: string[], dynamicSubs: Map<string, string>): string {
  const numberMatch = raw.match(/^(\d+(?:\.\d+)*\.?)(\s+)(.*)$/);
  if (!numberMatch) return applyBoldAndSubstitutions(raw, boldWords, dynamicSubs);

  const [, num, sep, rest] = numberMatch;
  const hasLetter = /[A-Za-zÀ-ÿ]/.test(rest);
  const hasLowercase = /[a-zà-ÿ]/.test(rest);
  const isUpperTitle = hasLetter && !hasLowercase;

  if (isUpperTitle) {
    return `<strong>${escapeHtml(num)}${sep}${escapeHtml(rest)}</strong>`;
  }
  return `<strong>${escapeHtml(num)}</strong>${sep}${applyBoldAndSubstitutions(rest, boldWords, dynamicSubs)}`;
}

// Uma "linha de tabela" é uma linha de quadro (tipo "Quadro-Resumo") colada
// direto do Word: cada célula vira um pedaço separado por tabulação quando
// colada como texto puro. Linha de texto corrido normal não tem tab no meio.
// O Word também usa tabulação só pra alinhar campos "Rótulo: valor" lado a
// lado (ex: "CPF:\t000.000.000-00\tRG:\t99 99 999-99") — isso NÃO é uma
// tabela, é o formato normal de campo, só que com tab no lugar de espaços.
// O que diferencia os dois é a célula de RÓTULO (a 1ª, 3ª, 5ª... célula, pulando
// de 2 em 2): no quadro-resumo ela nunca tem um "Rótulo:" no começo (ex:
// "Horário de acesso"); no campo normal, sempre começa assim (ex: "CPF:" ou,
// se sobrou um tab solto no fim da linha, "Contratante: JOAO DA SILVA" inteiro
// numa célula só). Checar o INÍCIO da célula (não se ela termina em ":") cobre
// os dois casos. E olhar só a célula de rótulo evita confundir com um ":" que
// apareça por acaso dentro do VALOR (ex: "Segunda a sexta: 07h00m às 19h00m").
const FIELD_LABEL_PREFIX_REGEX = /^[A-ZÀ-Ÿ][A-Za-zÀ-ÿ0-9°º/.() -]{0,40}?:/;

const BULLET_CHARS = '•·▪●○◦■□▫‣⁃';

function isTableRowLine(line: string): boolean {
  if (!line.includes('\t')) return false;
  const cells = line.split('\t').map((c) => c.trim());
  // lista com marcador ("•\ttexto") é item de lista, não célula de tabela
  if (cells[0].length === 1 && BULLET_CHARS.includes(cells[0])) return false;
  for (let i = 0; i < cells.length; i += 2) {
    if (FIELD_LABEL_PREFIX_REGEX.test(cells[i])) return false;
  }
  return true;
}

// Divide o texto colado em trechos "tabela" (linhas com tab, mais as barras
// de título em caixa alta coladas nelas, tipo "A. LOCADORA") e "normal" (todo
// o resto), pra cada um ser formatado do jeito certo. Isso permite colar um
// texto que tem um quadro-resumo em tabela E cláusulas normais no mesmo lugar.
function splitIntoSegments(rawLines: string[]): { type: 'table' | 'normal'; lines: string[] }[] {
  const n = rawLines.length;
  const marked = new Array<boolean>(n).fill(false);

  for (let i = 0; i < n; i++) {
    if (isTableRowLine(rawLines[i])) marked[i] = true;
  }

  // barra de título (sem tab) colada direto numa linha de tabela também entra
  for (let i = 0; i < n; i++) {
    if (marked[i]) continue;
    const trimmed = rawLines[i].trim();
    if (!trimmed || trimmed.endsWith(':') || !isHeadingLine(trimmed)) continue;
    const prevMarked = i > 0 && marked[i - 1];
    const nextMarked = i + 1 < n && marked[i + 1];
    if (prevMarked || nextMarked) marked[i] = true;
  }

  // linha em branco cercada de tabela dos dois lados também entra (não quebra o quadro)
  for (let i = 0; i < n; i++) {
    if (marked[i] || rawLines[i].trim() !== '') continue;
    let before = i - 1;
    while (before >= 0 && rawLines[before].trim() === '' && !marked[before]) before--;
    let after = i + 1;
    while (after < n && rawLines[after].trim() === '' && !marked[after]) after++;
    if (before >= 0 && marked[before] && after < n && marked[after]) marked[i] = true;
  }

  // uma tabela de verdade tem pelo menos 2 linhas com tab — uma linha isolada
  // com um tab perdido (ex: apertou Tab sem querer no Word depois de uma
  // palavra solta) não deve virar uma "tabela" de uma linha só.
  for (let i = 0; i < n; ) {
    if (!marked[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && marked[j]) j++;
    const tabLineCount = rawLines.slice(i, j).filter((l) => l.includes('\t')).length;
    if (tabLineCount < 2) {
      for (let k = i; k < j; k++) marked[k] = false;
    }
    i = j;
  }

  const segments: { type: 'table' | 'normal'; lines: string[] }[] = [];
  let current: string[] = [];
  let currentType: 'table' | 'normal' | null = null;

  for (let i = 0; i < n; i++) {
    const type: 'table' | 'normal' = marked[i] ? 'table' : 'normal';
    if (currentType !== null && type !== currentType) {
      segments.push({ type: currentType, lines: current });
      current = [];
    }
    currentType = type;
    current.push(rawLines[i]);
  }
  if (currentType !== null) segments.push({ type: currentType, lines: current });

  return segments;
}

// Renderiza um trecho "tabela": cada barra de título (sem tab) vira uma linha
// de cabeçalho preta ocupando a largura toda; cada linha com tab vira uma
// linha de células rótulo/valor (aos pares), usando o mesmo mapeamento de
// coringas e o mesmo aviso de "não cadastrado" que o resto do formatador.
function renderTableSegment(
  lines: string[],
  config: RulesConfig,
  dynamicSubs: Map<string, string>,
  unmapped: Set<string>,
): string {
  const rowLines = lines.filter((l) => l.trim() !== '');
  if (rowLines.length === 0) return '';

  const maxCols = rowLines.reduce((max, l) => (l.includes('\t') ? Math.max(max, l.split('\t').length) : max), 2);

  // Tabela comum (ex: anexos "Item | Estado | Observações"): não é quadro de
  // rótulo/valor em pares. Se não achou nenhum rótulo com coringa nas células
  // de rótulo e tem 3+ colunas (ou número ímpar de colunas), renderiza como
  // grade simples, uma <td> por célula, sem inventar coluna extra.
  const tabRows = rowLines.filter((l) => l.includes('\t'));
  const hasCoringaLabel = tabRows.some((l) =>
    l
      .split('\t')
      .filter((_, i) => i % 2 === 0)
      .some((c) => c.trim() && findCoringa(config, c.trim(), '') !== undefined),
  );
  if (maxCols >= 3 && (maxCols % 2 === 1 || !hasCoringaLabel)) {
    const gridRows = rowLines.map((line, idx) => {
      if (!line.includes('\t')) {
        return `<tr><td colspan="${maxCols}"><strong>${escapeHtml(line.trim())}</strong></td></tr>`;
      }
      const cells = line.split('\t').map((c) => c.trim());
      while (cells.length < maxCols) cells.push('');
      const isHeader = idx === rowLines.findIndex((l) => l.includes('\t'));
      const tds = cells
        .map((c) => {
          const inner = c ? escapeHtml(c) : '&nbsp;';
          return `<td>${isHeader || (c && cells[0] === c) ? `<strong>${inner}</strong>` : inner}</td>`;
        })
        .join('');
      return `<tr>${tds}</tr>`;
    });
    return (
      `<table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse;">\n` +
      `<tbody>\n${gridRows.join('\n')}\n</tbody>\n</table>`
    );
  }

  let headingHint = '';
  let titleHtml = '';
  const rowsHtml: string[] = [];

  for (const line of rowLines) {
    if (!line.includes('\t')) {
      headingHint = line.trim();
      // título logo na 1ª linha (ex: "QUADRO-RESUMO DA CONTRATAÇÃO") fica como
      // título normal acima da tabela; só as barras do meio ficam pretas.
      if (rowsHtml.length === 0) {
        titleHtml += `<p style="text-align: justify;"><strong>${escapeHtml(headingHint)}</strong></p>\n`;
        continue;
      }
      rowsHtml.push(
        `<tr><td colspan="${maxCols}" style="background: #000000; color: #ffffff; padding: 4px 6px;"><strong>${escapeHtml(headingHint)}</strong></td></tr>`,
      );
      continue;
    }

    const cells = line.split('\t').map((c) => c.trim());
    while (cells.length > 2 && cells[cells.length - 1] === '') cells.pop(); // tab solto no fim
    const cellsHtml: string[] = [];
    for (let i = 0; i < cells.length; i += 2) {
      const label = cells[i] ?? '';
      const value = cells[i + 1] ?? '';
      if (!label) {
        cellsHtml.push('<td>&nbsp;</td><td>&nbsp;</td>');
        continue;
      }
      const template = findCoringa(config, label, headingHint);
      let valueHtml: string;
      if (template === undefined) {
        unmapped.add(label);
        valueHtml = escapeHtml(value);
      } else {
        valueHtml = escapeHtml(template);
        if (value && value.length >= 3 && !value.includes('{')) {
          dynamicSubs.set(value, template);
        }
      }
      // se essa linha tem menos pares rótulo/valor que o máximo da tabela (ex:
      // "Atraso" sozinho numa linha de tabela com 4 colunas), o valor estica
      // até o fim pra não deixar um buraco vazio sem borda à direita.
      const isLastPair = i + 2 >= cells.length;
      const remainingCols = isLastPair ? maxCols - cells.length : 0;
      const valueColspanAttr = remainingCols > 0 ? ` colspan="${1 + remainingCols}"` : '';
      cellsHtml.push(`<td><strong>${escapeHtml(label)}</strong></td><td${valueColspanAttr}>${valueHtml}</td>`);
    }
    rowsHtml.push(`<tr>${cellsHtml.join('')}</tr>`);
  }

  return (
    titleHtml +
    `<table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse;">\n` +
    `<tbody>\n${rowsHtml.join('\n')}\n</tbody>\n</table>`
  );
}

type LineKind = 'heading' | 'field' | 'prose';

interface ParsedLine {
  kind: LineKind;
  raw: string;
  fields: FieldMatch[];
  index: number;
}

// Formata um trecho de texto corrido (sem linhas de tabela) — é o parser
// original: títulos, campos "Rótulo: valor", parágrafos numerados etc.
// dynamicSubs/unmapped são compartilhados entre todos os trechos do texto
// colado, pra uma troca descoberta num trecho valer pro resto do documento.
function formatNormalSegment(
  rawText: string,
  config: RulesConfig,
  dynamicSubs: Map<string, string>,
  unmapped: Set<string>,
  isFirstSegment: boolean,
): string {
  const rawLines = rawText.replace(/\t/g, '  ').split('\n');

  // ---------- passo 1: classifica cada linha ----------
  const parsed: ParsedLine[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      parsed.push({ kind: 'prose', raw: '', fields: [], index: i });
      continue;
    }
    if (isHeadingLine(line)) {
      parsed.push({ kind: 'heading', raw: line, fields: [], index: i });
      continue;
    }
    const fields = findFieldsInLine(line);
    if (fields.length > 0) {
      parsed.push({ kind: 'field', raw: line, fields, index: i });
      continue;
    }
    parsed.push({ kind: 'prose', raw: line, fields: [], index: i });
  }

  // ---------- passo 2: campo com rótulo mas sem valor na própria linha (o Word
  // quebrou o valor pra linha de baixo, às vezes com uma linha em branco no
  // meio por espaçamento) "puxa" a próxima linha como valor ----------
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    if (p.kind !== 'field' || p.fields.length !== 1) continue;
    const onlyField = p.fields[0];
    const hasValue = p.raw.slice(onlyField.valueStart).trim().length > 0;
    if (hasValue) continue;

    let j = i + 1;
    if (parsed[j] && parsed[j].kind === 'prose' && !parsed[j].raw) j++; // pula no máximo 1 linha em branco

    const next = parsed[j];
    if (next && next.kind === 'prose' && next.raw) {
      p.raw = `${p.raw} ${next.raw}`;
      parsed[j] = { kind: 'prose', raw: '', fields: [], index: next.index }; // vira linha em branco (consumida)
    }
  }

  // título de seção mais próximo ACIMA de cada linha (texto livre, qualquer um),
  // usado só como dica pra desempatar rótulo repetido em mais de um grupo (ver findCoringa)
  const headingBefore: string[] = [];
  {
    let lastHeading = '';
    for (const p of parsed) {
      if (p.kind === 'heading') lastHeading = p.raw;
      headingBefore[p.index] = lastHeading;
    }
  }

  // ---------- passo 3: resolve valor de cada campo (coringa ou mantém), registra
  // trocas dinâmicas (valor literal -> coringa) pra usar no resto do texto ----------
  function renderFieldLine(p: ParsedLine): string {
    const pieces: string[] = [];
    p.fields.forEach((field, i) => {
      const valueEnd = i + 1 < p.fields.length ? p.fields[i + 1].labelStart : p.raw.length;
      const originalValue = p.raw.slice(field.valueStart, valueEnd).trim();
      const template = findCoringa(config, field.label, headingBefore[p.index] ?? '');

      if (template === undefined) {
        unmapped.add(field.label);
        pieces.push(`<strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(originalValue)}`);
      } else {
        pieces.push(`<strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(template)}`);
        // registra o valor literal digitado pra ser trocado pelo coringa em qualquer
        // outro lugar do texto (ex: nome da unidade repetido nas cláusulas)
        if (originalValue && originalValue.length >= 3 && !originalValue.includes('{')) {
          dynamicSubs.set(originalValue, template);
        }
      }
    });
    return pieces.join('&nbsp;&nbsp;&nbsp;&nbsp;');
  }

  // pré-varre só os campos primeiro, pra que uma troca dinâmica descoberta em CIMA no
  // texto (ex: nome da unidade na seção II) já valha pra clausulas ANTES dela também
  // (raro, mas evita depender da ordem) e principalmente pra tudo que vem depois.
  const fieldHtmlCache = new Map<number, string>();
  parsed.forEach((p) => {
    if (p.kind === 'field') fieldHtmlCache.set(p.index, renderFieldLine(p));
  });

  // ---------- passo 4: agrupa linhas consecutivas em blocos ----------
  // heading/field seguidos formam um bloco só; heading sozinho (sem field junto)
  // vira título centralizado. Linhas de texto corrido (prose) consecutivas são
  // juntadas num parágrafo só (merge: true) — o Word costuma quebrar a linha no
  // meio da frase só por causa da largura da página, não porque é um parágrafo
  // novo; só uma linha em branco ou o início de uma cláusula numerada nova
  // (ex: "3.2.") encerra o parágrafo atual.
  type Block = { lines: ParsedLine[]; merge?: boolean };
  const blocks: Block[] = [];
  let current: ParsedLine[] = [];
  let proseLines: ParsedLine[] = [];
  // início de cláusula numerada ("3.2.") ou de item de lista ("•") = parágrafo novo
  const CLAUSE_START_REGEX = new RegExp(`^(?:\\d+(?:\\.\\d+)*\\.?\\s|[${BULLET_CHARS}]\\s)`);

  function flush(): void {
    if (current.length > 0) blocks.push({ lines: current });
    current = [];
  }

  function flushProse(): void {
    if (proseLines.length > 0) blocks.push({ lines: proseLines, merge: true });
    proseLines = [];
  }

  for (const p of parsed) {
    if (p.kind === 'prose') {
      if (!p.raw) {
        flushProse();
        flush();
        continue;
      }
      if (CLAUSE_START_REGEX.test(p.raw)) {
        flush();
        flushProse();
        proseLines = [p];
      } else {
        if (proseLines.length === 0) flush();
        proseLines.push(p);
      }
      continue;
    }
    flushProse();
    current.push(p);
  }
  flushProse();
  flush();

  // ---------- passo 5: renderiza cada bloco ----------
  const htmlParts: string[] = [];

  for (const block of blocks) {
    const hasField = block.lines.some((l) => l.kind === 'field');

    if (block.merge) {
      const joined = block.lines
        .map((l) => l.raw.trim())
        .join(' ')
        .replace(new RegExp(`^([${BULLET_CHARS}])\\s+`), '$1 '); // "•  texto" -> "• texto"
      const content = renderNumberedOrPlain(joined, config.boldWords, dynamicSubs);
      htmlParts.push(`<p style="text-align: justify;">${content}</p>`);
      continue;
    }

    // título de cláusula numerado sozinho (ex: "3. OBJETO DA LOCAÇÃO"), sem
    // campos junto: segue o fluxo normal do texto, não centraliza.
    if (block.lines.length === 1 && block.lines[0].kind === 'heading' && /^\d/.test(block.lines[0].raw)) {
      const content = renderNumberedOrPlain(block.lines[0].raw, config.boldWords, dynamicSubs);
      htmlParts.push(`<p style="text-align: justify;">${content}</p>`);
      continue;
    }

    if (!hasField) {
      // só títulos (ex: "CLAUSULA PRIMEIRA" + "DO OBJETO"). Só centraliza
      // quando é o PRIMEIRO bloco do texto colado — ali é o título do
      // documento (ex: "CONTRATO DE LOCAÇÃO..." / "QUADRO-RESUMO"), que no
      // Word fica centralizado de verdade. Título de cláusula no meio do
      // texto (ex: "CLÁUSULA DÉCIMA SEGUNDA" / "SOLIDARIEDADE") segue o
      // fluxo normal, só em negrito — centralizar todo título solto gerava
      // falso positivo nesses casos.
      const isDocumentTitle = isFirstSegment && htmlParts.length === 0;
      const align = isDocumentTitle ? 'center' : 'justify';
      const inner = block.lines.map((l) => `<strong>${escapeHtml(l.raw)}</strong>`).join('<br />\n');
      htmlParts.push(`<p style="text-align: ${align};">${inner}</p>`);
      continue;
    }

    // bloco misto (títulos + campos): justificado, cada linha separada por <br />
    const inner = block.lines
      .map((l) => {
        if (l.kind === 'heading') return `<strong>${escapeHtml(l.raw)}</strong>`;
        return fieldHtmlCache.get(l.index) ?? '';
      })
      .join('<br />\n');
    htmlParts.push(`<p style="text-align: justify;">${inner}</p>`);
  }

  return htmlParts.join('\n\n');
}

export function formatProspecto(rawText: string, config: RulesConfig): FormatResult {
  const rawLines = rawText.replace(/\r\n/g, '\n').split('\n');
  const segments = splitIntoSegments(rawLines);

  const unmapped = new Set<string>();
  const dynamicSubs = new Map<string, string>(); // valor literal encontrado -> coringa
  const htmlParts: string[] = [];

  segments.forEach((segment, i) => {
    const html =
      segment.type === 'table'
        ? renderTableSegment(segment.lines, config, dynamicSubs, unmapped)
        : formatNormalSegment(segment.lines.join('\n'), config, dynamicSubs, unmapped, i === 0);
    if (html) htmlParts.push(html);
  });

  return { html: htmlParts.join('\n\n'), unmappedFields: Array.from(unmapped) };
}
