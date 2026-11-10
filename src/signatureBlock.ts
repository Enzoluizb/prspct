// Bloco de assinatura/testemunhas padrão do Prisma. É sempre igual (só muda
// por coringa), então fica fixo aqui em vez de editável — diferente do CSS
// (aba CSS), que varia de contrato pra contrato.
export const SIGNATURE_BLOCK_HTML = `<p>{CIDADE_UNIDADE},&nbsp;{DT_INICIO_CONTRATO}</p>

<p>&nbsp;</p>

<p>&nbsp;</p>

<table align="center" border="0" cellpadding="1" cellspacing="1" style="width: 700px;">
	<tbody>
		<tr>
			<td>
			<p><strong>LOCAT&Aacute;RIO:</strong></p>
			</td>
			<td>
			<p><strong>LOCADORA:</strong></p>
			</td>
		</tr>
		<tr>
			<td>
			<p>{ASSINATURA_LINHA}</p>
			</td>
			<td>
			<p>{ASSINATURA_LINHA}</p>
			</td>
		</tr>
		<tr>
			<td>
			<p>{NOME_CLIENTE}</p>
			</td>
			<td>
			<p>{UNIDADE}</p>
			</td>
		</tr>
		<tr>
			<td>
			<p>{CPF_CNPJ_CLIENTE}</p>
			</td>
			<td>
			<p>{CNPJ_UNIDADE}</p>
			</td>
		</tr>
		<tr>
			<td>
			<p>{RESPONSAVEL_NOME1}</p>
			</td>
			<td>
			<p>&nbsp;</p>
			</td>
		</tr>
		<tr>
			<td>
			<p>{RESPONSAVEL_CPF1}</p>
			</td>
			<td>
			<p>&nbsp;</p>
			</td>
		</tr>
		<tr>
			<td>
			<p>{RESPONSAVEL_NOME2}</p>
			</td>
			<td>
			<p>&nbsp;</p>
			</td>
		</tr>
		<tr>
			<td>
			<p>{RESPONSAVEL_CPF2}</p>
			</td>
			<td>
			<p>&nbsp;</p>
			</td>
		</tr>
		<tr>
			<td>
			<p>&nbsp;</p>
			</td>
			<td>
			<p>&nbsp;</p>
			</td>
		</tr>
		<tr>
			<td>
			<p><strong>TESTEMUNHA 1</strong></p>
			</td>
			<td>
			<p><strong>TESTEMUNHA&nbsp;2</strong></p>
			</td>
		</tr>
		<tr>
			<td>
			<p>{ASSINATURA_LINHA}</p>

			<p>Nome:</p>

			<p>CPF:</p>
			</td>
			<td>
			<p>{ASSINATURA_LINHA}</p>

			<p>Nome:</p>

			<p>CPF:</p>
			</td>
		</tr>
	</tbody>
</table>

<p>&nbsp;</p>

<p>{PAGE_BREAK}<br />
<br />
{APOLICES_SEGURO}</p>

<p>{ADENDOS_CONTRATO}</p>`;

// Marcador que ocupa o lugar do bloco de assinatura original no texto colado;
// depois de formatar, é trocado pelo SIGNATURE_BLOCK_HTML (ver main.ts).
export const SIGNATURE_PLACEHOLDER = '@@ASSINATURA_PADRAO@@';

// O bloco de assinatura que o cliente manda tem uma linha CURTA "LOCADORA:" ou
// "LOCADORA - NOME". Linha longa que começa com "LOCADORA: ..." (ex: a
// qualificação da locadora, logo depois do quadro-resumo) NÃO é assinatura.
const SIGNATURE_START_REGEX = /^LOCADORA\s*(?::|[-–—]\s*\S)/i;
const SIGNATURE_START_MAX_LENGTH = 80;
// Cada anexo tem a sua própria assinatura, então o bloco principal termina
// onde começa o primeiro anexo.
const ANNEX_START_REGEX = /^ANEXO\s+(?:[IVXLC]+|\d+)\b/i;

// Linhas que costumam fazer parte do bloco de assinatura (traços, rótulos das
// partes, testemunhas, "Nome:"/"CPF:" curtos). Usadas pra voltar a partir da
// linha LOCADORA e incluir o que vem antes dela no bloco.
const SIGNATURE_LIKE_REGEXES: RegExp[] = [
  /^[_\-–—\s]{5,}$/,
  /^LOCAT[ÁA]RIO(?:\(A\))?\s*(?:[:\-–—].{0,60})?$/i,
  /^LOCADORA\s*(?:[:\-–—].{0,60})?$/i,
  /^TESTEMUNHAS?\s*\d*\s*:?$/i,
  /^\d\s*:\s*_{3,}$/,
  /^(?:Nome|CPF|CNPJ|RG)\s*:.{0,50}$/i,
  /^ASSINATURAS?\s*:?$/i,
];

// Troca o trecho de assinatura/testemunhas (da ÚLTIMA linha curta "LOCADORA..."
// antes dos anexos, voltando pelas linhas de assinatura que vêm antes dela, até
// logo antes do primeiro "ANEXO ...", ou até o fim se não houver anexos) por um
// marcador, pra o bloco padrão entrar NO MESMO LUGAR. Devolve null se não
// achou o bloco (nesse caso nada do texto é cortado).
export function replaceSignatureBlock(rawText: string): string | null {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');

  let annex = lines.findIndex((line) => ANNEX_START_REGEX.test(line.trim()));
  if (annex === -1) annex = lines.length;

  let start = -1;
  for (let i = 0; i < annex; i++) {
    const t = lines[i].trim();
    if (SIGNATURE_START_REGEX.test(t) && t.length <= SIGNATURE_START_MAX_LENGTH) start = i;
  }
  if (start === -1) return null;

  // volta incluindo as linhas de assinatura logo acima (traços, LOCATÁRIO etc.)
  for (let k = start - 1; k >= 0; k--) {
    const t = lines[k].trim();
    if (t === '') continue;
    if (SIGNATURE_LIKE_REGEXES.some((r) => r.test(t))) start = k;
    else break;
  }

  return [...lines.slice(0, start), '', SIGNATURE_PLACEHOLDER, '', ...lines.slice(annex)].join('\n');
}
