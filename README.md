# Formatador de Prospecto (Prisma)

Ferramenta interna: cola o texto do contrato (vindo do Word), clica em **Formatar
para o Prisma**, e recebe o HTML já com rótulos em negrito e os dados do cliente,
da unidade e do contrato trocados pelos coringas do sistema (`{NOME_CLIENTE}`,
`{CPF_CNPJ_CLIENTE}`, `{BOXES_CONTRATO}`...), pronto pra colar em **Código-Fonte**
no editor de Texto do Prisma.

## Rodar local

Pré-requisito: [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm run dev     # abre em http://localhost:5173
npm test        # testes automatizados (vitest)
```

## Publicar (GitHub Pages)

O workflow `.github/workflows/deploy.yml` publica a cada `push` na `main` ou na
`master`. No GitHub: **Settings → Pages → Source = "GitHub Actions"**. Link:
`https://<usuario>.github.io/<repo>/`.

## O que o formatador reconhece

- **Campos `Rótulo: valor`** (um ou vários na mesma linha): rótulo em negrito e
  valor trocado pelo coringa cadastrado na aba **Coringas**. O valor digitado
  também é trocado em qualquer outro lugar do texto (ex: nome da unidade
  repetido nas cláusulas). Rótulo repetido em grupos diferentes (ex: "E-mail" do
  cliente e da unidade) é resolvido pelo título de seção mais próximo.
- **Padrões de texto** (`src/patterns.ts`), pra contratos que não vêm em campos:
  `Box nº [●]` → `{BOXES_CONTRATO}`, metragem → `{BOXES_M2}`,
  `[nome/razão social...]` → `{NOME_CLIENTE}`, `CPF/CNPJ nº [●]`, `RG/IE nº [●]`,
  endereço/e-mail/telefone `[●]`, `R$ [●] ([valor por extenso])` (valor mensal ou
  valor declarado dos bens), `Data de entrega [●]`, `[Cidade/UF], [data]` (→ `{CIDADE_UNIDADE}, {DATA_ATUAL}`).
- **Tabelas** coladas do Word (células separadas por tab): quadro-resumo
  (rótulo/valor em pares; barras de título no meio ficam pretas) e tabelas
  comuns de anexo (grade simples, cabeçalho em negrito).
- **Caixas** (tabela de uma célula só no Word, tipo CONTRATADA/CONTRATANTE): ao
  colar, o formatador lê o HTML que o Word manda junto, acha essas tabelas e
  marca o trecho no texto com `[[CAIXA]]` ... `[[/CAIXA]]`; elas saem como
  tabela com borda. Sem tabela no Word, nada muda. Dá pra digitar os marcadores
  na mão se precisar.
- **Listas** com `•`, `a)`, `(a)`, `i)`: um parágrafo por item (nunca tabela).
- **Cláusulas numeradas** (`3.`, `3.1.`): número em negrito; título em caixa alta
  fica todo em negrito.
- **Testemunhas**: `Nome:` e `CPF:` sob "TESTEMUNHA" ficam só como rótulo.
- **Assinatura padrão** (checkbox na aba Texto): o bloco de assinatura do
  contrato (da linha `LOCADORA:` ou `LOCADORA - NOME` até o primeiro `ANEXO`) é
  trocado pela assinatura padrão do Prisma, no mesmo lugar. Os anexos, cada um
  com sua assinatura, ficam como estão. Sem bloco no texto, a assinatura vai pro fim.

## Regras editáveis e backup

Aba **Coringas**: coringas por rótulo e "negritar sempre", editáveis sem mexer
em código e salvos neste navegador. **Exportar JSON** / **Importar JSON** serve
de backup e pra passar a configuração pra outra pessoa.

As regras "de fábrica" ficam em `src/mappings.ts` (`DEFAULT_RULES`). Quando o
código ganha coringas novos (e `DEFAULTS_VERSION` sobe), eles são somados
automaticamente às regras salvas de cada navegador, sem apagar o que a pessoa
editou — basta publicar o site de novo.

## Estrutura

- `src/formatter.ts` — texto → HTML (campos, tabelas, listas, cláusulas).
- `src/patterns.ts` — coringas por padrão de texto.
- `src/mappings.ts` — regras de fábrica e persistência.
- `src/signatureBlock.ts` — assinatura padrão e substituição do bloco original.
- `src/main.ts` — interface.
- `tests/` — testes automatizados.
