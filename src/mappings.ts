// Configuracao de formatacao. Duas listas, totalmente editaveis na aba
// "Coringas / Negrito" (nada aqui e fixo por unidade/contrato):
//
// 1) coringas: campos no formato "Rótulo: valor" (ex: "Contratante: Fulano") viram
//    "<b>Rótulo:</b> {O_CORINGA}". Não depende de em qual "seção" do texto o campo
//    está — o rótulo é procurado em qualquer lugar do texto colado.
//    O "grupo" é só pra organizar a tela (ex: "Locatário", "Locadora", "Locação"),
//    não afeta a formatação.
//
// 2) boldWords: palavras/frases que devem SEMPRE ficar em negrito onde aparecerem
//    no texto (dentro ou fora de um campo "Rótulo: valor"), ex: "LOCATÁRIO(A)", "BOX".

export interface CoringaRule {
  id: string;
  label: string;
  coringa: string;
  group: string;
}

export interface RulesConfig {
  coringas: CoringaRule[];
  boldWords: string[];
  // CSS personalizado opcional, reaproveitado entre contratos (aba "CSS").
  customCss: string;
}

let idCounter = 0;
function id(): string {
  idCounter += 1;
  return `r${Date.now().toString(36)}${idCounter}`;
}

function coringa(label: string, value: string, group: string): CoringaRule {
  return { id: id(), label, coringa: value, group };
}

export const DEFAULT_RULES: RulesConfig = {
  coringas: [
    // Locatário (cliente)
    coringa('Nome', '{NOME_CLIENTE}', 'Locatário (cliente)'),
    coringa('Contratante', '{NOME_CLIENTE}', 'Locatário (cliente)'),
    coringa('Profissão/Ramo de Atividade', '{CLIENTE_ATIVIDADE}', 'Locatário (cliente)'),
    coringa('CPF', '{CPF_CNPJ_CLIENTE}', 'Locatário (cliente)'),
    coringa('CNPJ', '{CPF_CNPJ_CLIENTE}', 'Locatário (cliente)'),
    coringa('CPF/CNPJ', '{CPF_CNPJ_CLIENTE}', 'Locatário (cliente)'),
    coringa('RG', '{RG_CLIENTE}', 'Locatário (cliente)'),
    coringa('Endereço', '{ENDERECO_COMPLETO_CLIENTE}', 'Locatário (cliente)'),
    coringa('Endereço de correspondência', '{ENDERECO_CLIENTE}', 'Locatário (cliente)'),
    coringa('Telefone', '{TELEFONE2_CLIENTE}', 'Locatário (cliente)'),
    coringa('Telefone1', '{TELEFONE1_CLIENTE}', 'Locatário (cliente)'),
    coringa('Telefone2', '{TELEFONE2_CLIENTE}', 'Locatário (cliente)'),
    coringa('E-mail', '{EMAIL_CLIENTE}', 'Locatário (cliente)'),
    // estes 4 são um "chute" baseado no padrão dos outros coringas — confirme os
    // nomes certos no sistema e ajuste aqui se precisar:
    coringa('Bairro', '{BAIRRO_CLIENTE}', 'Locatário (cliente)'),
    coringa('CEP', '{CEP_CLIENTE}', 'Locatário (cliente)'),
    coringa('Cidade', '{CIDADE_CLIENTE}', 'Locatário (cliente)'),
    coringa('UF', '{UF_CLIENTE}', 'Locatário (cliente)'),

    // Locadora (a unidade de self storage, nossa cliente)
    coringa('Denominação social', '{UNIDADE_FANTASIA}', 'Locadora (unidade)'),
    coringa('Inscrição no CNPJ/MF', '{CNPJ_UNIDADE}', 'Locadora (unidade)'),
    coringa('Razão Social', '{UNIDADE}', 'Locadora (unidade)'),
    coringa('Sede Social', '{ENDERECO_COMPLETO_UNIDADE}', 'Locadora (unidade)'),
    coringa('Endereço', '{ENDERECO_COMPLETO_UNIDADE}', 'Locadora (unidade)'),
    coringa('Pix para pagamentos', '{CNPJ_UNIDADE}', 'Locadora (unidade)'),
    coringa('Telefone da Empresa', '{TEL2_UNIDADE}', 'Locadora (unidade)'),
    coringa('E-mail', '{EMAIL_UNIDADE}', 'Locadora (unidade)'),
    // chute — confirme o nome certo no sistema:
    coringa('CEP', '{CEP_UNIDADE}', 'Locadora (unidade)'),

    // Locação (dados do contrato em si)
    coringa('Valor da locação', '{VALOR_TOTAL_CONTRATO} ({S_VALOR_TOTAL_CONTRATO})', 'Locação (contrato)'),
    coringa('Desconto', '{PERC_FIXO_DESCONTO_CONTRATO}', 'Locação (contrato)'),
    coringa('Início da Locação', '{DT_INICIO_CONTRATO}', 'Locação (contrato)'),
    coringa('Término da Locação', '{DT_FIM_CONTRATO} {DT_VENCIMENTO_CONTRATO}', 'Locação (contrato)'),
    // texto padrão (boilerplate), igual em todo contrato — mantém sempre esse texto
    coringa(
      'Prazo de Renovação',
      '30 (trinta) dias prorrogável automaticamente pelo mesmo período após a data de término da locação.',
      'Locação (contrato)',
    ),
    coringa('Número e Metragem do(s) BOXE(s)', 'Box nº {BOXES_CONTRATO}, com {BOXES_M2}.', 'Locação (contrato)'),
    coringa('Valor total declarado', '{VALOR_TOTAL_BENS_DECLARADOS} {S_VALOR_TOTAL_BENS_DECLARADOS}', 'Locação (contrato)'),
  ],
  boldWords: ['LOCATÁRIO(A)', 'LOCADORA', 'BOX'],
  customCss: '',
};

const STORAGE_KEY = 'prospecto-formatter:rules-v3';

export function loadRules(): RulesConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_RULES);
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.coringas) || !Array.isArray(parsed.boldWords)) {
      return structuredClone(DEFAULT_RULES);
    }
    if (typeof parsed.customCss !== 'string') parsed.customCss = '';
    return parsed as RulesConfig;
  } catch {
    return structuredClone(DEFAULT_RULES);
  }
}

export function saveRules(config: RulesConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetRules(): RulesConfig {
  const fresh = structuredClone(DEFAULT_RULES);
  saveRules(fresh);
  return fresh;
}

export function newRuleId(): string {
  return id();
}
