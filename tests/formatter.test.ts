import { describe, expect, it } from 'vitest';
import { formatProspecto } from '../src/formatter';
import { DEFAULT_RULES } from '../src/mappings';
import { replaceSignatureBlock, SIGNATURE_PLACEHOLDER } from '../src/signatureBlock';

const fmt = (text: string) => formatProspecto(text, DEFAULT_RULES).html;

describe('listas', () => {
  it('item com • não vira tabela, um parágrafo por item', () => {
    const html = fmt('7.1. São obrigações:\n•\tpagar em dia;\n•\tmanter cadastro;');
    expect(html).not.toContain('<table');
    expect(html).toContain('• pagar em dia;');
    expect(html).toContain('• manter cadastro;');
  });

  it('itens a), b) viram parágrafos separados e não tabela', () => {
    const html = fmt('8.1. É proibido:\na)\tarmas;\nb)\tdrogas;');
    expect(html).not.toContain('<table');
    expect(html).toContain('a) armas;');
    expect(html).toContain('b) drogas;');
  });
});

describe('tabelas', () => {
  it('"CPF:" vazio não vira barra preta', () => {
    const html = fmt('TESTEMUNHA 2\nNome:\nCPF:\nANEXO I - DECLARAÇÃO DE CONTEÚDO\nEu, declaro.');
    expect(html).not.toContain('#000000');
  });

  it('tabela de anexo com 3 colunas não ganha coluna extra', () => {
    const html = fmt('Item vistoriado\tEstado\tObservações\nPiso\t[ ] bom\t\nTeto\t[ ] bom\t');
    const firstRow = html.match(/<tr>.*?<\/tr>/)![0];
    expect((firstRow.match(/<td/g) ?? []).length).toBe(3);
  });

  it('título na 1ª linha do quadro-resumo fica sem fundo preto', () => {
    const html = fmt('QUADRO-RESUMO DA CONTRATAÇÃO\nContrato nº\t[●]\nUnidade Max Storage\tTIJUCAS');
    expect(html).not.toContain('#000000');
    expect(html).toContain('<strong>QUADRO-RESUMO DA CONTRATAÇÃO</strong>');
  });
});

describe('testemunha', () => {
  it('Nome/CPF de testemunha não recebem coringa', () => {
    const html = fmt('TESTEMUNHA 1\nNome:\nCPF:');
    expect(html).not.toContain('{NOME_CLIENTE}');
    expect(html).not.toContain('{CPF_CNPJ_CLIENTE}');
  });
});

describe('assinatura padrão', () => {
  const contrato = [
    '22.1. Fica eleito o foro.',
    '',
    '____________',
    'LOCADORA - MAX STORAGE',
    '____________',
    'TESTEMUNHA 1',
    'Nome:',
    'CPF:',
    '',
    'ANEXO I - DECLARAÇÃO',
    'Eu, declaro.',
  ].join('\n');

  it('entra antes dos anexos e preserva os anexos', () => {
    const out = replaceSignatureBlock(contrato)!;
    expect(out.indexOf(SIGNATURE_PLACEHOLDER)).toBeGreaterThan(-1);
    expect(out.indexOf(SIGNATURE_PLACEHOLDER)).toBeLessThan(out.indexOf('ANEXO I'));
    expect(out).not.toContain('TESTEMUNHA');
  });

  it('sem bloco de assinatura devolve null', () => {
    expect(replaceSignatureBlock('só texto')).toBeNull();
  });
});

describe('coringas por padrão de texto', () => {
  it('Box nº [●] vira {BOXES_CONTRATO}', () => {
    expect(fmt('O Box nº [●] será entregue.')).toContain('Box nº {BOXES_CONTRATO}');
  });

  it('Box nº 12 também vira coringa', () => {
    expect(fmt('Locação do Box nº 12 no galpão.')).toContain('Box nº {BOXES_CONTRATO}');
  });

  it('metragem, locatário e valor declarado', () => {
    const html = fmt(
      'Eu, [nome/razão social do Locatário], CPF/CNPJ nº [●], RG/IE nº [●], declaro valor global declarado de R$ [●] ([valor por extenso]). Box nº [●] | Metragem aproximada: [ ● ] m².',
    );
    expect(html).toContain('{NOME_CLIENTE}');
    expect(html).toContain('{CPF_CNPJ_CLIENTE}');
    expect(html).toContain('{RG_CLIENTE}');
    expect(html).toContain('R$ {VALOR_TOTAL_BENS_DECLARADOS} ({S_VALOR_TOTAL_BENS_DECLARADOS})');
    expect(html).toContain('{BOXES_M2}');
  });

  it('valor mensal no quadro-resumo e coringa não é negritado por "BOX"', () => {
    const html = fmt('QUADRO\nValor mensal\tR$ [●] (valor por extenso)\nBox locado\tBox nº [●], metragem aproximada [●] m².');
    expect(html).toContain('{VALOR_TOTAL_CONTRATO} ({S_VALOR_TOTAL_CONTRATO})');
    expect(html).toContain('{BOXES_CONTRATO}');
    expect(html).not.toContain('<strong>{BOXES');
  });

  it('[Cidade/UF], [data] vira coringa', () => {
    expect(fmt('assinam. [Cidade/UF], [data].')).toContain('{CIDADE_UNIDADE}, {DATA_ATUAL}');
  });
});
