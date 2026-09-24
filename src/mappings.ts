// Configuracao de formatacao: como cada "Rotulo: valor" deve virar HTML pro Prisma.
//
// Estrutura:
// - Cada SECAO (ex: "LOCATARIO", "LOCADOR") e identificada por uma linha que so tem
//   o titulo (sem ":"), tipo "LOCATARIO" sozinho numa linha.
// - Dentro de uma secao, cada CAMPO conhecido (ex: "Nome") tem um "template" que diz
//   o que colocar no lugar do valor digitado.
//     - Se o template tiver um coringa (ex: "{NOME_CLIENTE}"), o valor original e
//       DESCARTADO e substituido pelo coringa (o dado fica dinamico, vem do contrato).
//     - Se o campo nao tiver template (mapeado como null), o valor digitado e
//       MANTIDO como esta, so o rotulo fica em negrito (dado fixo, ex: dados da empresa).
// - Campo que aparece no texto mas nao esta cadastrado aqui: o rotulo ainda fica em
//   negrito (fica bonito do mesmo jeito) mas o valor e mantido, e ele entra na lista
//   de "nao mapeados" pra voce saber que pode cadastrar um coringa se for o caso.

export interface SectionMap {
  // chave = nome do rotulo como aparece antes dos ":" (comparacao ignora maiusc/minusc e espacos)
  // valor = template com o(s) coringa(s), ou null para manter o valor original (dado fixo)
  [label: string]: string | null;
}

export interface MappingConfig {
  // chave = titulo da secao (linha sozinha, ex: "LOCATARIO"), comparacao ignora maiusc/minusc
  sections: {
    [sectionTitle: string]: SectionMap;
  };
  // usado quando um campo aparece fora de qualquer secao reconhecida
  fallback: SectionMap;
}

export const DEFAULT_MAPPING: MappingConfig = {
  sections: {
    LOCATÁRIO: {
      Nome: '{NOME_CLIENTE}',
      CPF: '{CPF_CNPJ_CLIENTE}',
      CNPJ: '{CPF_CNPJ_CLIENTE}',
      'CPF/CNPJ': '{CPF_CNPJ_CLIENTE}',
      Endereço: '{ENDERECO_COMPLETO_CLIENTE}',
      Telefones: '{TELEFONE1_CLIENTE} {TELEFONE2_CLIENTE}',
      Telefone: '{TELEFONE1_CLIENTE}',
      'E-mail': '{EMAIL_CLIENTE}',
      Email: '{EMAIL_CLIENTE}',
    },
    LOCADOR: {
      // dados da propria empresa: ficam fixos (o valor digitado e mantido), so nego rita o rotulo
      'Razão Social': null,
      CNPJ: null,
      'Inscrição Estadual': null,
      Endereço: null,
    },
  },
  fallback: {},
};

const STORAGE_KEY = 'prospecto-formatter:mapping';

export function loadMapping(): MappingConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_MAPPING);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.sections || !parsed.fallback) {
      return structuredClone(DEFAULT_MAPPING);
    }
    return parsed as MappingConfig;
  } catch {
    return structuredClone(DEFAULT_MAPPING);
  }
}

export function saveMapping(config: MappingConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetMapping(): MappingConfig {
  const fresh = structuredClone(DEFAULT_MAPPING);
  saveMapping(fresh);
  return fresh;
}
