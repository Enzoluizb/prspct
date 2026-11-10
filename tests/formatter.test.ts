import { describe, expect, it } from 'vitest';
import { formatProspecto } from '../src/formatter';
import { DEFAULT_RULES } from '../src/mappings';
import { applyTables, wrapBoxes } from '../src/pasteBoxes';
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
    expect(html).toContain('declarado de {VALOR_TOTAL_BENS_DECLARADOS} ({S_VALOR_TOTAL_BENS_DECLARADOS})');
    expect(html).not.toContain('R$');
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

describe('contrato Guarde Coisas (modelo CONTRATANTE/CONTRATADA)', () => {
  it('numeração de cláusula com tab não vira tabela', () => {
    const txt = [
      'I.\tDAS PARTES',
      '',
      '3.1\tO valor devido pelo CONTRATANTE é de R$450,00 (Quatrocentos e cinquenta reais ), que deve ser pago.',
      '3.2\tO pagamento poderá ser realizado através de boleto.',
      '3.3\tApós o primeiro período, o valor poderá sofrer reajustes.',
    ].join('\n');
    const html = fmt(txt);
    expect(html).not.toContain('<table');
    expect(html).toContain('<strong>I.  DAS PARTES</strong>');
  });

  it('título romano em caixa mista fica em negrito', () => {
    expect(fmt('XVII. Cláusula de Responsabilidade sobre Itens Armazenados:')).toContain(
      '<strong>XVII. Cláusula de Responsabilidade sobre Itens Armazenados:</strong>',
    );
  });

  it('valores reais viram coringa só no valor mensal, não em multas', () => {
    const html = fmt(
      '3.1 O valor devido pelo CONTRATANTE a CONTRATADA pelos primeiros 30 (Trinta) dias é de R$450,00 (Quatrocentos e cinquenta reais ), que deve ser pago.\n\n6.3 Será cobrado taxa de R$100,00 (cem reais) para a primeira hora.',
    );
    expect(html).toContain('{VALOR_TOTAL_CONTRATO} ({S_VALOR_TOTAL_CONTRATO})');
    expect(html).toContain('R$100,00 (cem reais)');
  });

  it('número do contrato, box, plano, datas e CNPJ', () => {
    const html = fmt(
      [
        'INSTRUMENTO PARTICULAR DE CONTRATO',
        'Nº DO CONTRATO:00001',
        '',
        'inscrita no CNPJ: 99.999.999/9999-99 , por seus representantes legais.',
        '',
        '2.1 loca uma unidade CAIXA DE Nº 00001, 00005 , que ficará no depósito.',
        '4.1 O prazo do presente contrato será Mensal , iniciando-se no dia 22/11/2024 com término em 22/12/2024 ocorrendo renovação.',
      ].join('\n'),
    );
    expect(html).toContain('{NUMERO_CONTRATO}');
    expect(html).toContain('{CNPJ_UNIDADE}');
    expect(html).toContain('CAIXA DE Nº {BOXES_CONTRATO}');
    expect(html).toContain('será {PLANO_CONTRATO}');
    expect(html).toContain('no dia {DT_INICIO_CONTRATO}');
    expect(html).toContain('término em {DT_FIM_CONTRATO}');
  });

  it('campos do CONTRATANTE com rótulo em caixa alta', () => {
    const html = fmt('CONTRATANTE\nNOME / RAZÃO SOCIAL: JOAO DA SILVA\nCPF / CNPJ: 000.000.000-00\nEMAIL: ricardo@gmail.com');
    expect(html).toContain('{NOME_CLIENTE}');
    expect(html).toContain('{CPF_CNPJ_CLIENTE}');
    expect(html).toContain('{EMAIL_CLIENTE}');
  });

  it('tabela de desconto por antecipação vira {TABELA_DESCONTO_ANTECIPACAO}', () => {
    const html = fmt('DESCONTO POR ANTECIPAÇÃO\nDESCONTO\tDIAS ANTES DO VENCIMENTO\n3%\t5\n\nII. DO OBJETO');
    expect(html).toContain('{TABELA_DESCONTO_ANTECIPACAO}');
    expect(html).not.toContain('3%');
    expect(html).not.toContain('<table');
  });
});

describe('caixas (tabela de uma célula colada do Word)', () => {
  const plain = [
    'I. DAS PARTES',
    '',
    'CONTRATADA',
    '',
    'GUARDE COISAS, sociedade inscrita no CNPJ: 99.999.999/9999-99 , por seus representantes.',
    '',
    'CONTRATANTE',
    'NOME / RAZÃO SOCIAL: JOAO DA SILVA',
    'CPF / CNPJ: 000.000.000-00',
    '',
    'II. DO OBJETO',
  ].join('\n');

  const boxes = [
    ['CONTRATADA', 'GUARDE COISAS, sociedade inscrita no CNPJ: 99.999.999/9999-99 , por seus representantes.'],
    ['CONTRATANTE', 'NOME / RAZÃO SOCIAL: JOAO DA SILVA', 'CPF / CNPJ: 000.000.000-00'],
  ];

  it('sem marcação (sem tabela no HTML) nada vira caixa', () => {
    expect(formatProspecto(plain, DEFAULT_RULES).html).not.toContain('<table');
    expect(wrapBoxes(plain, [])).toBe(plain);
  });

  it('wrapBoxes marca só os trechos das caixas, ignorando espaços e linhas em branco', () => {
    const out = wrapBoxes(plain, boxes);
    expect((out.match(/\[\[CAIXA\]\]/g) ?? []).length).toBe(2);
    expect((out.match(/\[\[\/CAIXA\]\]/g) ?? []).length).toBe(2);
    expect(out.indexOf('II. DO OBJETO')).toBeGreaterThan(out.lastIndexOf('[[/CAIXA]]'));
  });

  it('caixa que não aparece no texto é ignorada', () => {
    expect(wrapBoxes('só texto', [['outra coisa']])).toBe('só texto');
  });

  it('marcado: cada caixa vira tabela com borda, coringas valem e o resto fica fora', () => {
    const html = formatProspecto(wrapBoxes(plain, boxes), DEFAULT_RULES).html;
    expect((html.match(/<table/g) ?? []).length).toBe(2);
    expect(html).toContain('{NOME_CLIENTE}');
    expect(html).toContain('{CNPJ_UNIDADE}');
    expect(html).not.toContain('[[CAIXA]]');
    expect(html.indexOf('II. DO OBJETO')).toBeGreaterThan(html.lastIndexOf('</table>'));
  });
});

describe('caixas: parágrafo quebrado em várias linhas no HTML', () => {
  it('acha a caixa mesmo com quebra de linha diferente do texto puro', () => {
    const plain = ['Antes', '', 'CONTRATADA', '', 'GUARDE COISAS, sociedade inscrita no CNPJ: 99 , por seus representantes legais.', '', 'Depois'].join('\n');
    const box = ['CONTRATADA', 'GUARDE COISAS, sociedade inscrita', 'no CNPJ: 99 , por seus', 'representantes legais.'];
    const out = wrapBoxes(plain, [box]);
    expect(out).toContain('[[CAIXA]]\nCONTRATADA');
    expect(out).toContain('legais.\n[[/CAIXA]]');
    expect(out.indexOf('Antes')).toBeLessThan(out.indexOf('[[CAIXA]]'));
  });
});

describe('tabela com célula de várias linhas (Word quebra a linha da tabela)', () => {
  const plain = [
    'ENDEREÇO\t[Nome / Razão Social]\tCIDADE\tPalmas',
    'BOX Nº\t[_____]\tÁREA APROX.\t[_____] m²',
    'ACESSO\t2ªs. a 6ªs.',
    'das 8:30 às 18:00hs.\tFECHAMENTO\tcadeado/chave do cliente',
    'SEGURO OPCIONAL\t( ) SIM ( ) NÃO\tVALOR AUTODECLARADO',
    '(para fins de seguro)\tR$ [_______]',
    '',
    'LOCADORA: ÚNICA SERVIÇOS STORAGE LTDA.',
  ].join('\n');

  const table = {
    kind: 'grid' as const,
    rows: [
      ['ENDEREÇO', '[Nome / Razão Social]', 'CIDADE', 'Palmas'],
      ['BOX Nº', '[_____]', 'ÁREA APROX.', '[_____] m²'],
      ['ACESSO', '2ªs. a 6ªs. das 8:30 às 18:00hs.', 'FECHAMENTO', 'cadeado/chave do cliente'],
      ['SEGURO OPCIONAL', '( ) SIM ( ) NÃO', 'VALOR AUTODECLARADO (para fins de seguro)', 'R$ [_______]'],
    ],
  };

  it('reconstrói as linhas da tabela, com a célula de várias linhas inteira', () => {
    const fixed = applyTables(plain, [table]);
    expect(fixed).toContain('ACESSO\t2ªs. a 6ªs. das 8:30 às 18:00hs.\tFECHAMENTO\tcadeado/chave do cliente');
    expect(fixed).toContain('VALOR AUTODECLARADO (para fins de seguro)\tR$ [_______]');
    expect(fixed).toContain('LOCADORA: ÚNICA SERVIÇOS STORAGE LTDA.');
  });

  it('na tabela formatada não sobra linha quebrada', () => {
    const html = formatProspecto(applyTables(plain, [table]), DEFAULT_RULES).html;
    expect(html).not.toContain('<td><strong>das 8:30');
    expect(html).not.toContain('<td><strong>(para fins de seguro)');
    expect((html.match(/<table/g) ?? []).length).toBe(1);
    const acesso = html.match(/<tr>(?:(?!<\/tr>).)*ACESSO.*?<\/tr>/)![0];
    expect(acesso).toContain('das 8:30 às 18:00hs.');
    expect(acesso).toContain('FECHAMENTO');
  });
});

describe('assinatura padrão não pode comer as cláusulas', () => {
  const contrato = [
    'CONTRATO DE LOCAÇÃO',
    'LOCATÁRIO\tNome\tCPF/CNPJ\t[__]',
    'LOCADORA: ÚNICA SERVIÇOS STORAGE LTDA., inscrita no CNPJ nº 61.504.744/0001-38, com sede em Palmas, TO.',
    'As partes celebram este contrato.',
    '1. DO OBJETO',
    '1.1. A ÚNICA aluga ao cliente um box.',
    '6. RESPONSABILIDADES E SEGURO',
    '6.1. O LOCATÁRIO é responsável por embalar.',
    '',
    'Palmas, 10 de novembro.',
    '',
    '______________________',
    'LOCATÁRIO(A)',
    '______________________',
    'LOCADORA - ÚNICA SERVIÇOS',
    'TESTEMUNHA 1',
    'Nome:',
    'CPF:',
    '',
    'ANEXO I - DECLARAÇÃO',
    'Eu, declaro.',
  ].join('\n');

  it('mantém cláusulas e a linha longa "LOCADORA: ..." e troca só a assinatura final', () => {
    const out = replaceSignatureBlock(contrato)!;
    expect(out).toContain('LOCADORA: ÚNICA SERVIÇOS STORAGE LTDA., inscrita');
    expect(out).toContain('1.1. A ÚNICA aluga ao cliente um box.');
    expect(out).toContain('6.1. O LOCATÁRIO é responsável por embalar.');
    expect(out).toContain('Palmas, 10 de novembro.');
    expect(out).toContain('ANEXO I - DECLARAÇÃO');
    expect(out).toContain(SIGNATURE_PLACEHOLDER);
    expect(out).not.toContain('TESTEMUNHA 1');
    expect(out).not.toContain('LOCADORA - ÚNICA SERVIÇOS');
    expect(out.indexOf(SIGNATURE_PLACEHOLDER)).toBeGreaterThan(out.indexOf('Palmas, 10 de novembro.'));
    expect(out.indexOf(SIGNATURE_PLACEHOLDER)).toBeLessThan(out.indexOf('ANEXO I'));
  });

  it('só a linha longa "LOCADORA: ..." (sem assinatura): não corta nada', () => {
    const txt = ['LOCADORA: ÚNICA SERVIÇOS STORAGE LTDA., inscrita no CNPJ nº 61.504.744/0001-38, com sede em Palmas, TO.', '1. DO OBJETO', '1.1. Texto.'].join('\n');
    expect(replaceSignatureBlock(txt)).toBeNull();
  });
});
