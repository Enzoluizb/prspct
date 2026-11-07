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

// O bloco de assinatura que o cliente manda começa numa linha "LOCADORA:" ou
// "LOCADORA - NOME" sozinha (o texto digitado que viria antes, tipo "1. DADOS
// DA LOCADORA:", tem algo antes de "LOCADORA" na linha, então não cai aqui).
const SIGNATURE_START_REGEX = /^LOCADORA\s*(?::|[-–—]\s*\S)/i;
// Cada anexo tem a sua própria assinatura, então o bloco principal termina
// onde começa o primeiro anexo.
const ANNEX_START_REGEX = /^ANEXO\s+(?:[IVXLC]+|\d+)\b/i;
const SIGNATURE_LINE_REGEX = /^[_\-–—\s]{5,}$/;

// Troca o trecho de assinatura/testemunhas (da linha "LOCADORA..." até logo
// antes do primeiro "ANEXO ...", ou até o fim se não houver anexos) por um
// marcador, pra o bloco padrão entrar NO MESMO LUGAR. Devolve null se não
// achou o bloco.
export function replaceSignatureBlock(rawText: string): string | null {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  let start = lines.findIndex((line) => SIGNATURE_START_REGEX.test(line.trim()));
  if (start === -1) return null;
  // a linha de traços (___) logo acima de "LOCADORA" faz parte da assinatura
  let k = start - 1;
  while (k >= 0 && lines[k].trim() === '') k--;
  if (k >= 0 && SIGNATURE_LINE_REGEX.test(lines[k])) start = k;

  let end = lines.findIndex((line, i) => i > start && ANNEX_START_REGEX.test(line.trim()));
  if (end === -1) end = lines.length;

  return [...lines.slice(0, start), '', SIGNATURE_PLACEHOLDER, '', ...lines.slice(end)].join('\n');
}
