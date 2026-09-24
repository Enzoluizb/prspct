import './style.css';
import { formatProspecto } from './formatter';
import { loadRules, saveRules, resetRules, newRuleId, type RulesConfig, type CoringaRule } from './mappings';

let rules: RulesConfig = loadRules();

// ---------- Tabs ----------
const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
const tabPanels = document.querySelectorAll<HTMLElement>('.tab-panel');

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    tabPanels.forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
  });
});

// ---------- Formatar ----------
const inputText = document.getElementById('input-text') as HTMLTextAreaElement;
const outputPreview = document.getElementById('output-preview') as HTMLDivElement;
const outputHtml = document.getElementById('output-html') as HTMLTextAreaElement;
const unmappedWarning = document.getElementById('unmapped-warning') as HTMLDivElement;
const btnFormat = document.getElementById('btn-format') as HTMLButtonElement;
const btnCopy = document.getElementById('btn-copy') as HTMLButtonElement;
const copyFeedback = document.getElementById('copy-feedback') as HTMLSpanElement;
const chkFooter = document.getElementById('chk-footer') as HTMLInputElement;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

btnFormat.addEventListener('click', () => {
  const result = formatProspecto(inputText.value, rules);
  let html = result.html;
  if (chkFooter.checked && rules.footerHtml.trim()) {
    html += `\n\n${rules.footerHtml.trim()}`;
  }
  outputHtml.value = html;
  outputPreview.innerHTML = html;

  if (result.unmappedFields.length > 0) {
    unmappedWarning.classList.remove('hidden');
    unmappedWarning.innerHTML =
      '<strong>Campos sem coringa cadastrado (mantidos como digitado):</strong>' +
      result.unmappedFields.map((f) => `<div>${escapeHtml(f)}</div>`).join('');
  } else {
    unmappedWarning.classList.add('hidden');
    unmappedWarning.innerHTML = '';
  }
});

btnCopy.addEventListener('click', async () => {
  if (!outputHtml.value) return;
  await navigator.clipboard.writeText(outputHtml.value);
  copyFeedback.classList.remove('hidden');
  setTimeout(() => copyFeedback.classList.add('hidden'), 1500);
});

// ---------- Coringas / Negrito ----------
const boldWordsContainer = document.getElementById('bold-words-container') as HTMLDivElement;
const btnAddBoldWord = document.getElementById('btn-add-bold-word') as HTMLButtonElement;
const coringasContainer = document.getElementById('coringas-container') as HTMLDivElement;
const btnAddCoringa = document.getElementById('btn-add-coringa') as HTMLButtonElement;
const footerHtmlInput = document.getElementById('footer-html') as HTMLTextAreaElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import') as HTMLButtonElement;
const importFile = document.getElementById('import-file') as HTMLInputElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;

function persist(): void {
  saveRules(rules);
}

function renderRulesEditor(): void {
  renderBoldWords();
  renderCoringas();
  footerHtmlInput.value = rules.footerHtml;
}

function renderBoldWords(): void {
  boldWordsContainer.innerHTML = '';
  rules.boldWords.forEach((word, index) => {
    const row = document.createElement('div');
    row.className = 'bold-word-row';

    const input = document.createElement('input');
    input.value = word;
    input.placeholder = 'Ex: LOCADORA';
    input.addEventListener('change', () => {
      rules.boldWords[index] = input.value;
      persist();
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-field';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remover';
    removeBtn.addEventListener('click', () => {
      rules.boldWords.splice(index, 1);
      persist();
      renderBoldWords();
    });

    row.append(input, removeBtn);
    boldWordsContainer.appendChild(row);
  });
}

btnAddBoldWord.addEventListener('click', () => {
  rules.boldWords.push('');
  persist();
  renderBoldWords();
});

function renderCoringas(): void {
  coringasContainer.innerHTML = '';

  if (rules.coringas.length > 0) {
    const header = document.createElement('div');
    header.className = 'coringa-row-header';
    header.innerHTML = '<span>Rótulo</span><span>Coringa</span><span>Grupo</span><span></span>';
    coringasContainer.appendChild(header);
  }

  rules.coringas.forEach((rule) => {
    coringasContainer.appendChild(buildCoringaRow(rule));
  });
}

function buildCoringaRow(rule: CoringaRule): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'coringa-row';

  const labelInput = document.createElement('input');
  labelInput.value = rule.label;
  labelInput.placeholder = 'Ex: Nome';
  labelInput.addEventListener('change', () => {
    rule.label = labelInput.value;
    persist();
  });

  const coringaInput = document.createElement('input');
  coringaInput.value = rule.coringa;
  coringaInput.placeholder = 'Ex: {NOME_CLIENTE} (vazio = manter valor digitado)';
  coringaInput.addEventListener('change', () => {
    rule.coringa = coringaInput.value;
    persist();
  });

  const groupInput = document.createElement('input');
  groupInput.value = rule.group;
  groupInput.placeholder = 'Ex: Locatário (cliente)';
  groupInput.addEventListener('change', () => {
    rule.group = groupInput.value;
    persist();
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-field';
  removeBtn.textContent = '✕';
  removeBtn.title = 'Remover';
  removeBtn.addEventListener('click', () => {
    rules.coringas = rules.coringas.filter((r) => r.id !== rule.id);
    persist();
    renderCoringas();
  });

  row.append(labelInput, coringaInput, groupInput, removeBtn);
  return row;
}

btnAddCoringa.addEventListener('click', () => {
  rules.coringas.push({ id: newRuleId(), label: '', coringa: '', group: '' });
  persist();
  renderCoringas();
});

footerHtmlInput.addEventListener('change', () => {
  rules.footerHtml = footerHtmlInput.value;
  persist();
});

btnExport.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'regras-prospecto.json';
  a.click();
  URL.revokeObjectURL(url);
});

btnImport.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.coringas) || !Array.isArray(parsed.boldWords)) {
      throw new Error('formato inválido');
    }
    if (typeof parsed.footerHtml !== 'string') parsed.footerHtml = '';
    rules = parsed as RulesConfig;
    persist();
    renderRulesEditor();
  } catch (err) {
    alert('Não foi possível importar esse arquivo: ' + (err as Error).message);
  } finally {
    importFile.value = '';
  }
});

btnReset.addEventListener('click', () => {
  if (!confirm('Isso vai apagar suas alterações e voltar às regras padrão. Continuar?')) return;
  rules = resetRules();
  renderRulesEditor();
});

renderRulesEditor();
