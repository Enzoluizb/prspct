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
// de texto livre (que ainda NAO foi escapado pra HTML). Comparação ignora
// maiúsculas/minúsculas (ex: cadastra "Guarde Safe Self Storage" e também pega
// "GUARDE SAFE SELF STORAGE" em caixa alta no meio das cláusulas).
function applyBoldAndSubstitutions(text: string, boldWords: string[], dynamicSubs: Map<string, string>): string {
  // termo mais longo primeiro, pra um termo curto não "comer" parte de um termo longo
  const terms = [
    ...Array.from(dynamicSubs.entries()).map(([t, replacement]) => ({ text: t, replacement })),
    ...boldWords.filter((w) => w.trim()).map((w) => ({ text: w, replacement: null as string | null })),
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
    const shown = term?.replacement ?? matched;
    result += escapeHtml(text.slice(lastIndex, m.index ?? 0));
    result += `<strong>${escapeHtml(shown)}</strong>`;
    lastIndex = (m.index ?? 0) + matched.length;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

type LineKind = 'heading' | 'field' | 'prose';

interface ParsedLine {
  kind: LineKind;
  raw: string;
  fields: FieldMatch[];
  index: number;
}

export function formatProspecto(rawText: string, config: RulesConfig): FormatResult {
  const rawLines = rawText.replace(/\r\n/g, '\n').replace(/\t/g, '  ').split('\n');
  const unmapped = new Set<string>();
  const dynamicSubs = new Map<string, string>(); // valor literal encontrado -> coringa

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
  // quebrou o valor pra linha de baixo) "puxa" a próxima linha como valor ----------
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    if (p.kind !== 'field' || p.fields.length !== 1) continue;
    const onlyField = p.fields[0];
    const hasValue = p.raw.slice(onlyField.valueStart).trim().length > 0;
    if (hasValue) continue;
    const next = parsed[i + 1];
    if (next && next.kind === 'prose' && next.raw) {
      p.raw = `${p.raw} ${next.raw}`;
      parsed[i + 1] = { kind: 'prose', raw: '', fields: [], index: next.index }; // vira linha em branco (consumida)
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
  // vira título centralizado; prose sempre é bloco próprio.
  type Block = { lines: ParsedLine[] };
  const blocks: Block[] = [];
  let current: ParsedLine[] = [];

  function flush(): void {
    if (current.length > 0) blocks.push({ lines: current });
    current = [];
  }

  for (const p of parsed) {
    if (p.kind === 'prose') {
      flush();
      if (p.raw) blocks.push({ lines: [p] });
      continue;
    }
    current.push(p);
  }
  flush();

  // ---------- passo 5: renderiza cada bloco ----------
  const htmlParts: string[] = [];

  for (const block of blocks) {
    const hasField = block.lines.some((l) => l.kind === 'field');

    if (block.lines.length === 1 && block.lines[0].kind === 'prose') {
      const line = block.lines[0];
      const numberMatch = line.raw.match(/^(\d+(?:\.\d+)*\.?)(\s+)(.*)$/);
      let content: string;
      if (numberMatch) {
        const [, num, sep, rest] = numberMatch;
        content = `<strong>${escapeHtml(num)}</strong>${sep}${applyBoldAndSubstitutions(rest, config.boldWords, dynamicSubs)}`;
      } else {
        content = applyBoldAndSubstitutions(line.raw, config.boldWords, dynamicSubs);
      }
      htmlParts.push(`<p style="text-align: justify;">${content}</p>`);
      continue;
    }

    if (!hasField) {
      // só títulos (ex: "CLAUSULA PRIMEIRA" + "DO OBJETO"): centraliza
      const inner = block.lines.map((l) => `<strong>${escapeHtml(l.raw)}</strong>`).join('<br />\n');
      htmlParts.push(`<p style="text-align: center;">${inner}</p>`);
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

  const html = htmlParts.join('\n\n');
  return { html, unmappedFields: Array.from(unmapped) };
}
