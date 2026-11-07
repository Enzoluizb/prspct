// Preenchimento automático por PADRÃO DE TEXTO (não depende de "Rótulo: valor").
// Serve pros contratos que não vêm no formato de campos, e sim com marcadores do
// tipo "Box nº [●]" ou "[nome/razão social do Locatário]" no meio do texto.
//
// Cada padrão tem dois grupos de captura:
//   grupo 1 = contexto que fica como está (ex: "Box nº ")
//   grupo 2 = o trecho que vira coringa (ex: "[●]" ou "12")
// Os coringas usados são os mesmos já cadastrados na aba "Coringas".

export interface PatternRule {
  name: string;
  regex: RegExp;
  coringa: string;
}

// "[●]", "[ ● ]", "[•]"...
const PH = String.raw`\[\s*[●•○■]\s*\]`;
// "([valor por extenso])", "(por extenso)", "(valor por extenso)"
const EXTENSO = String.raw`\(\s*\[?\s*(?:valor\s+)?(?:por\s+)?extenso\s*\]?\s*\)`;

export const PATTERN_RULES: PatternRule[] = [
  // valor declarado dos bens vem ANTES do valor genérico (mesma posição de início)
  {
    name: 'valor declarado dos bens',
    regex: new RegExp(String.raw`(valor\s+global\s+declarado\s+de\s+R\$\s*)(${PH}\s*${EXTENSO})`, 'gi'),
    coringa: '{VALOR_TOTAL_BENS_DECLARADOS} ({S_VALOR_TOTAL_BENS_DECLARADOS})',
  },
  {
    name: 'valor mensal',
    regex: new RegExp(String.raw`(R\$\s*)(${PH}\s*${EXTENSO})`, 'gi'),
    coringa: '{VALOR_TOTAL_CONTRATO} ({S_VALOR_TOTAL_CONTRATO})',
  },
  { name: 'box', regex: new RegExp(String.raw`(\bBox\s+n[º°o]\.?\s*)(${PH}|\d+[A-Za-z]?\b)`, 'gi'), coringa: '{BOXES_CONTRATO}' },
  {
    name: 'metragem',
    regex: new RegExp(String.raw`(\bmetragem(?:\s+aproximada)?:?\s*)(${PH}\s*m²|\d+(?:[.,]\d+)?\s*m²)`, 'gi'),
    coringa: '{BOXES_M2}',
  },
  {
    name: 'data de entrega/início',
    regex: new RegExp(String.raw`(\bData\s+de\s+(?:entrega|início):?\s*)(${PH})`, 'gi'),
    coringa: '{DT_INICIO_CONTRATO}',
  },
  {
    name: 'nome do locatário',
    regex: /()(\[\s*nome\s*\/\s*razão\s+social[^\]]*\])/gi,
    coringa: '{NOME_CLIENTE}',
  },
  { name: 'cpf/cnpj', regex: new RegExp(String.raw`(\bCPF(?:\s*\/\s*CNPJ)?\s+n[º°o]\s*)(${PH})`, 'gi'), coringa: '{CPF_CNPJ_CLIENTE}' },
  { name: 'rg', regex: new RegExp(String.raw`(\bRG(?:\s*\/\s*IE)?\s+n[º°o]\s*)(${PH})`, 'gi'), coringa: '{RG_CLIENTE}' },
  { name: 'endereço', regex: new RegExp(String.raw`(\bendereço\s*)(${PH})`, 'gi'), coringa: '{ENDERECO_COMPLETO_CLIENTE}' },
  { name: 'e-mail', regex: new RegExp(String.raw`(\be-mail\s*)(${PH})`, 'gi'), coringa: '{EMAIL_CLIENTE}' },
  {
    name: 'telefone',
    regex: new RegExp(String.raw`(\btelefone(?:\s*\/\s*WhatsApp)?\s*)(${PH})`, 'gi'),
    coringa: '{TELEFONE2_CLIENTE}',
  },
  {
    name: 'cidade e data',
    regex: /()(\[\s*Cidade\s*\/\s*UF\s*\]\s*,\s*\[\s*data\s*\])/gi,
    coringa: '{CIDADE_UNIDADE}, {DATA_ATUAL}',
  },
];

export interface TextPiece {
  text: string;
  // true = trecho já é um coringa; não deve sofrer outras trocas (negrito etc.)
  isCoringa: boolean;
}

// Divide o texto em pedaços: os que casaram com algum padrão viram o coringa
// (isCoringa), o resto fica como está. Em caso de sobreposição, vale o que
// começa primeiro e, empatando, o padrão que vem antes na lista.
export function splitByPatterns(text: string): TextPiece[] {
  const found: { start: number; end: number; coringa: string; order: number }[] = [];
  PATTERN_RULES.forEach((rule, order) => {
    for (const m of text.matchAll(rule.regex)) {
      const prefix = m[1] ?? '';
      const target = m[2] ?? '';
      if (!target) continue;
      const start = (m.index ?? 0) + prefix.length;
      found.push({ start, end: start + target.length, coringa: rule.coringa, order });
    }
  });
  found.sort((a, b) => a.start - b.start || a.order - b.order);

  const pieces: TextPiece[] = [];
  let cursor = 0;
  for (const f of found) {
    if (f.start < cursor) continue; // sobreposto a um já aplicado
    if (f.start > cursor) pieces.push({ text: text.slice(cursor, f.start), isCoringa: false });
    pieces.push({ text: f.coringa, isCoringa: true });
    cursor = f.end;
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor), isCoringa: false });
  return pieces;
}
