import type { MappingConfig } from './mappings';

export interface FormatResult {
  html: string;
  unmappedFields: string[]; // rotulos encontrados que nao tem mapeamento cadastrado
}

// Uma linha e "titulo de secao" se for só texto (sem ":" no meio), curta, e vier
// maiúscula (permite variar de contrato pra contrato sem mexer no código:
// "LOCATÁRIO(A)", "II - LOCADORA", "III - LOCAÇÃO", "CLÁUSULA PRIMEIRA" etc).
// Um ":" sozinho no final (ex: "LOCATÁRIO(A):") não desqualifica — só indica
// que a seção não tem valor na própria linha.
function isSectionHeader(line: string): boolean {
  let trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith(':')) trimmed = trimmed.slice(0, -1).trim();
  if (!trimmed || trimmed.includes(':')) return false;
  if (trimmed.length > 50) return false;
  // pelo menos uma letra, e nenhuma letra minuscula (acentos inclusos)
  const hasLetter = /[A-Za-zÀ-ÿ]/.test(trimmed);
  const hasLowercase = /[a-zà-ÿ]/.test(trimmed);
  return hasLetter && !hasLowercase;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function findTemplate(map: Record<string, string | null> | undefined, label: string): string | null | undefined {
  if (!map) return undefined;
  const target = normalizeLabel(label);
  for (const key of Object.keys(map)) {
    if (normalizeLabel(key) === target) return map[key];
  }
  return undefined;
}

// Estilo do "cabecalho de secao" (barra amarela em negrito), igual ao padrao usado
// nos prospectos atuais. Ajuste a cor aqui se o padrao mudar.
const SECTION_HEADER_STYLE = 'background:#ffc000;padding:4px 8px;display:block;';

// Detecta um ou mais campos "Rótulo: valor" dentro da MESMA linha, ex:
// "CPF:  {CPF_CNPJ_CLIENTE}     RG: {RG_CLIENTE}" -> dois campos.
// Um novo rótulo só é reconhecido no início da linha OU depois de 2+ espaços
// (é assim que o Word normalmente alinha campos lado a lado numa tabela/coluna).
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

export function formatProspecto(rawText: string, config: MappingConfig): FormatResult {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const htmlParts: string[] = [];
  const unmapped = new Set<string>();

  let currentSection: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      htmlParts.push('<p>&nbsp;</p>');
      continue;
    }

    if (isSectionHeader(line)) {
      const headerText = line.endsWith(':') ? line.slice(0, -1).trim() : line;
      currentSection = headerText;
      htmlParts.push(`<p style="${SECTION_HEADER_STYLE}"><strong>${escapeHtml(headerText)}</strong></p>`);
      continue;
    }

    const fields = findFieldsInLine(line);
    if (fields.length === 0) {
      // linha de texto livre (paragrafo normal, sem rotulo)
      htmlParts.push(`<p>${escapeHtml(line)}</p>`);
      continue;
    }

    const sectionMap = currentSection ? config.sections[findSectionKey(config, currentSection)] : undefined;
    const pieces: string[] = [];

    fields.forEach((field, i) => {
      const valueEnd = i + 1 < fields.length ? fields[i + 1].labelStart : line.length;
      const originalValue = line.slice(field.valueStart, valueEnd).trim();

      let template = findTemplate(sectionMap, field.label);
      if (template === undefined) template = findTemplate(config.fallback, field.label);

      if (template === undefined) {
        // rotulo desconhecido: negrita mas mantem o valor, e avisa
        unmapped.add(currentSection ? `${currentSection} > ${field.label}` : field.label);
        pieces.push(`<strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(originalValue)}`);
      } else if (template === null) {
        // campo fixo/boilerplate: mantem o valor original digitado
        pieces.push(`<strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(originalValue)}`);
      } else {
        // campo dinamico: troca pelo(s) coringa(s), descarta o valor digitado
        pieces.push(`<strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(template)}`);
      }
    });

    htmlParts.push(`<p>${pieces.join('&nbsp;&nbsp;&nbsp;&nbsp;')}</p>`);
  }

  return { html: htmlParts.join('\n'), unmappedFields: Array.from(unmapped) };
}

function findSectionKey(config: MappingConfig, sectionTitle: string): string {
  const target = normalizeLabel(sectionTitle);
  for (const key of Object.keys(config.sections)) {
    if (normalizeLabel(key) === target) return key;
  }
  return sectionTitle;
}
