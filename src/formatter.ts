import type { MappingConfig } from './mappings';

export interface FormatResult {
  html: string;
  unmappedFields: string[]; // rotulos encontrados que nao tem mapeamento cadastrado
}

// Uma linha e "titulo de secao" se for só texto (sem ":"), curto, e vier maiúsculo
// (permite variar de projeto pra projeto sem precisar mexer no codigo: "LOCATARIO",
// "LOCADOR", "TESTEMUNHAS", etc.)
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.includes(':')) return false;
  if (trimmed.length > 40) return false;
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
      currentSection = line;
      htmlParts.push(`<p style="${SECTION_HEADER_STYLE}"><strong>${escapeHtml(line)}</strong></p>`);
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex > 0) {
      const label = line.slice(0, separatorIndex).trim();
      const originalValue = line.slice(separatorIndex + 1).trim();

      const sectionMap = currentSection ? config.sections[findSectionKey(config, currentSection)] : undefined;
      let template = findTemplate(sectionMap, label);
      if (template === undefined) {
        template = findTemplate(config.fallback, label);
      }

      if (template === undefined) {
        // rotulo desconhecido: negrita mas mantem o valor, e avisa
        unmapped.add(currentSection ? `${currentSection} > ${label}` : label);
        htmlParts.push(`<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(originalValue)}</p>`);
      } else if (template === null) {
        // campo fixo: mantem o valor original digitado
        htmlParts.push(`<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(originalValue)}</p>`);
      } else {
        // campo dinamico: troca pelo(s) coringa(s), descarta o valor digitado
        htmlParts.push(`<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(template)}</p>`);
      }
      continue;
    }

    // linha de texto livre (paragrafo normal, sem rotulo)
    htmlParts.push(`<p>${escapeHtml(line)}</p>`);
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
