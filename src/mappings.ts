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
    // Baseado no prospecto-modelo (contrato de locação de BOX). Nomes de seção
    // aqui devem bater com o texto do título na linha (sem o ":" final, se tiver).
    'LOCATÁRIO(A)': {
      Nome: '{NOME_CLIENTE}',
      Contratante: '{NOME_CLIENTE}',
      'Profissão/Ramo de Atividade': '{CLIENTE_ATIVIDADE}',
      CPF: '{CPF_CNPJ_CLIENTE}',
      CNPJ: '{CPF_CNPJ_CLIENTE}',
      'CPF/CNPJ': '{CPF_CNPJ_CLIENTE}',
      RG: '{RG_CLIENTE}',
      Endereço: '{ENDERECO_COMPLETO_CLIENTE}',
      'Endereço de correspondência': '{ENDERECO_CLIENTE}',
      Telefone: '{TELEFONE2_CLIENTE}',
      Telefone1: '{TELEFONE1_CLIENTE}',
      Telefone2: '{TELEFONE2_CLIENTE}',
      Telefones: '{TELEFONE1_CLIENTE} {TELEFONE2_CLIENTE}',
      'E-mail': '{EMAIL_CLIENTE}',
      Email: '{EMAIL_CLIENTE}',
    },
    'II - LOCADORA': {
      // a "locadora" e a unidade de self storage nossa cliente: os dados dela
      // tambem sao dinamicos (mudam de unidade pra unidade), por isso viram coringa.
      'Denominação social': '{UNIDADE_FANTASIA}',
      'Inscrição no CNPJ/MF': '{CNPJ_UNIDADE}',
      'Razão Social': '{UNIDADE}',
      'Sede Social': '{ENDERECO_COMPLETO_UNIDADE}',
      'Pix para pagamentos': '{CNPJ_UNIDADE}',
      'Telefone da Empresa': '{TEL2_UNIDADE}',
      'E-mail': '{EMAIL_UNIDADE}',
    },
    'III - LOCAÇÃO': {
      'Valor da locação': '{VALOR_TOTAL_CONTRATO} ({S_VALOR_TOTAL_CONTRATO})',
      Desconto: '{PERC_FIXO_DESCONTO_CONTRATO}',
      'Início da Locação': '{DT_INICIO_CONTRATO}',
      'Término da Locação': '{DT_FIM_CONTRATO} {DT_VENCIMENTO_CONTRATO}',
      // texto padrao (boilerplate) que se repete igual em todo contrato: mantem como digitado
      'Prazo de Renovação': null,
      'Número e Metragem do(s) BOXE(s)': 'Box nº {BOXES_CONTRATO}, com {BOXES_M2}.',
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
