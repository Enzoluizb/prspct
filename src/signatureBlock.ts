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

// O bloco de assinatura que o cliente manda por e-mail sempre começa numa linha
// "LOCADORA:" sozinha (o texto digitado que viria antes, tipo "1. DADOS DA
// LOCADORA:", tem algo antes de "LOCADORA" na linha, então não cai aqui).
const SIGNATURE_START_REGEX = /^LOCADORA\s*:/i;

// Corta o texto colado a partir da linha de assinatura (inclusive), pra não
// formatar esse trecho junto com o resto — ele vai ser substituído pelo
// SIGNATURE_BLOCK_HTML. Se não achar o padrão, devolve o texto como veio.
export function stripSignatureBlock(rawText: string): string {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const cutIndex = lines.findIndex((line) => SIGNATURE_START_REGEX.test(line.trim()));
  if (cutIndex === -1) return rawText;
  return lines.slice(0, cutIndex).join('\n');
}
