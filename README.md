# Formatador de Prospecto (Prisma)

Ferramenta interna: cola o texto do contrato (vindo do Word), clica em **Formatar
para o Prisma**, e recebe o HTML já com os rótulos em negrito e os campos do
cliente trocados pelos coringas do sistema (`{NOME_CLIENTE}`, `{CPF_CNPJ_CLIENTE}`,
etc.), pronto pra colar em **Código-Fonte** no editor de Texto do Prisma.

## Rodar local

Pré-requisito: [Node.js](https://nodejs.org) instalado (versão 18+).

```bash
npm install
npm run dev
```

Abre o endereço que aparecer no terminal (algo como `http://localhost:5173`).

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e suba este projeto:
   ```bash
   git remote add origin <url-do-seu-repositorio>
   git add .
   git commit -m "Formatador de prospecto"
   git push -u origin main
   ```
2. No GitHub: **Settings → Pages → Build and deployment → Source** = "GitHub Actions".
3. O workflow em `.github/workflows/deploy.yml` já publica automaticamente a
   cada `push` na branch `main`. O link fica em `https://<seu-usuario>.github.io/<repo>/`.

## Como funciona o mapeamento (aba "Coringas / Mapeamento")

- O texto é lido linha por linha.
- Uma linha **sozinha, em maiúsculas e sem `:`** (ex: `LOCATÁRIO`) é tratada
  como título de seção.
- Uma linha no formato `Rótulo: valor` (ex: `Nome: João da Silva`) é tratada
  como campo: o rótulo sempre fica em negrito.
  - Se esse rótulo, dentro da seção atual, tiver um **coringa cadastrado**
    (ex: `{NOME_CLIENTE}`), o valor digitado é **substituído** pelo coringa.
  - Se o coringa estiver **em branco**, o valor digitado é **mantido** como
    está — use isso para dados fixos (ex: dados da própria empresa, que não
    mudam de contrato pra contrato).
  - Se o rótulo **não estiver cadastrado**, ele ainda fica em negrito, o valor
    é mantido, e ele aparece num aviso na tela pra você saber que pode
    cadastrar um coringa se for o caso.
- Tudo isso é editável na aba **Coringas / Mapeamento**, sem precisar mexer em
  código: dá pra adicionar seção, campo, coringa, remover, etc. Fica salvo no
  navegador. Use **Exportar JSON** pra fazer backup ou repassar a configuração
  pra outra pessoa (ela usa **Importar JSON**) — inclusive dá pra versionar
  esse JSON no repositório se um dia quisermos que o mapeamento venha
  "de fábrica" pra todo mundo.

## Estrutura

- `src/formatter.ts` — lógica de formatação (texto → HTML).
- `src/mappings.ts` — mapeamento padrão (rótulo → coringa) e persistência.
- `src/main.ts` — interface (abas, editor de mapeamento, copiar HTML).
