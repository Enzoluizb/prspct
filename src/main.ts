import './style.css';
import { formatProspecto } from './formatter';
import { loadRules, mergeNewDefaults, saveRules, resetRules, newRuleId, type RulesConfig, type CoringaRule } from './mappings';
import { SIGNATURE_BLOCK_HTML, SIGNATURE_PLACEHOLDER, replaceSignatureBlock } from './signatureBlock';

let rules: RulesConfig = loadRules();

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function persist(): void {
  saveRules(rules);
}

// ---------- Tema (claro/escuro) ----------
const THEME_KEY = 'prospecto-formatter:theme';
const themeSwitch = document.getElementById('theme-switch') as HTMLInputElement;

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
  themeSwitch.checked = theme === 'dark';
}

applyTheme((localStorage.getItem(THEME_KEY) as 'light' | 'dark') ?? 'light');

themeSwitch.addEventListener('change', () => {
  const theme: 'light' | 'dark' = themeSwitch.checked ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

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

// ---------- Negritar sempre (aba Texto) ----------
const boldWordsContainer = document.getElementById('bold-words-container') as HTMLDivElement;
const btnAddBoldWord = document.getElementById('btn-add-bold-word') as HTMLButtonElement;

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

// ---------- Seções de formatação (Texto / Cabeçalho / Rodapé) ----------
interface SectionConfig {
  input: HTMLTextAreaElement;
  btnFormat: HTMLButtonElement;
  outputPreview: HTMLDivElement;
  outputHtml: HTMLTextAreaElement;
  btnCopy: HTMLButtonElement;
  copyFeedback: HTMLSpanElement;
  unmappedWarning: HTMLDivElement;
  signatureCheckbox?: HTMLInputElement;
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function setupSection(config: SectionConfig): void {
  config.btnFormat.addEventListener('click', () => {
    const useSignatureTemplate = config.signatureCheckbox?.checked ?? false;
    const withPlaceholder = useSignatureTemplate ? replaceSignatureBlock(config.input.value) : null;
    const sourceText = withPlaceholder ?? config.input.value;

    const result = formatProspecto(sourceText, rules);
    let html = result.html;
    if (useSignatureTemplate) {
      const placeholderParagraph = new RegExp(`<p[^>]*>\\s*(?:<strong>)?\\s*${SIGNATURE_PLACEHOLDER}\\s*(?:</strong>)?\\s*</p>`);
      if (withPlaceholder !== null && placeholderParagraph.test(html)) {
        // assinatura padrão entra onde estava a original (antes dos anexos)
        html = html.replace(placeholderParagraph, () => SIGNATURE_BLOCK_HTML);
      } else {
        // não achou o bloco no texto: mantém o comportamento antigo (no fim)
        html = `${html}\n\n${SIGNATURE_BLOCK_HTML}`;
      }
    }
    config.outputHtml.value = html;
    config.outputPreview.innerHTML = html;

    if (result.unmappedFields.length > 0) {
      config.unmappedWarning.classList.remove('hidden');
      config.unmappedWarning.innerHTML =
        '<strong>Campos sem coringa cadastrado (mantidos como digitado):</strong>' +
        result.unmappedFields.map((f) => `<div>${escapeHtml(f)}</div>`).join('');
    } else {
      config.unmappedWarning.classList.add('hidden');
      config.unmappedWarning.innerHTML = '';
    }
  });

  config.btnCopy.addEventListener('click', async () => {
    if (!config.outputHtml.value) return;
    await navigator.clipboard.writeText(config.outputHtml.value);
    config.copyFeedback.classList.remove('hidden');
    setTimeout(() => config.copyFeedback.classList.add('hidden'), 1500);
  });
}

setupSection({
  input: byId('input-text'),
  btnFormat: byId('btn-format-texto'),
  outputPreview: byId('output-preview-texto'),
  outputHtml: byId('output-html-texto'),
  btnCopy: byId('btn-copy-texto'),
  copyFeedback: byId('copy-feedback-texto'),
  unmappedWarning: byId('unmapped-warning-texto'),
  signatureCheckbox: byId<HTMLInputElement>('chk-signature-texto'),
});

setupSection({
  input: byId('input-text-cabecalho'),
  btnFormat: byId('btn-format-cabecalho'),
  outputPreview: byId('output-preview-cabecalho'),
  outputHtml: byId('output-html-cabecalho'),
  btnCopy: byId('btn-copy-cabecalho'),
  copyFeedback: byId('copy-feedback-cabecalho'),
  unmappedWarning: byId('unmapped-warning-cabecalho'),
});

setupSection({
  input: byId('input-text-rodape'),
  btnFormat: byId('btn-format-rodape'),
  outputPreview: byId('output-preview-rodape'),
  outputHtml: byId('output-html-rodape'),
  btnCopy: byId('btn-copy-rodape'),
  copyFeedback: byId('copy-feedback-rodape'),
  unmappedWarning: byId('unmapped-warning-rodape'),
});

// ---------- CSS (extra) ----------
const inputCss = byId<HTMLTextAreaElement>('input-css');
const outputCss = byId<HTMLTextAreaElement>('output-css');
const btnCopyCss = byId<HTMLButtonElement>('btn-copy-css');
const copyFeedbackCss = byId<HTMLSpanElement>('copy-feedback-css');

function renderCssOutput(): void {
  outputCss.value = inputCss.value.trim() ? `<style>\n${inputCss.value.trim()}\n</style>` : '';
}

inputCss.value = rules.customCss;
renderCssOutput();

inputCss.addEventListener('input', () => {
  rules.customCss = inputCss.value;
  persist();
  renderCssOutput();
});

btnCopyCss.addEventListener('click', async () => {
  if (!outputCss.value) return;
  await navigator.clipboard.writeText(outputCss.value);
  copyFeedbackCss.classList.remove('hidden');
  setTimeout(() => copyFeedbackCss.classList.add('hidden'), 1500);
});

// ---------- Coringas / Mapeamento ----------
const coringasContainer = byId<HTMLDivElement>('coringas-container');
const groupFilterContainer = byId<HTMLDivElement>('group-filter');
const btnAddCoringa = byId<HTMLButtonElement>('btn-add-coringa');
const btnExport = byId<HTMLButtonElement>('btn-export');
const btnImport = byId<HTMLButtonElement>('btn-import');
const importFile = byId<HTMLInputElement>('import-file');
const btnReset = byId<HTMLButtonElement>('btn-reset');

const NO_GROUP_LABEL = 'Sem grupo';
let activeGroupFilter: string | null = null; // null = Todos

// Grupos distintos cadastrados, na ordem em que aparecem (vira os filtros).
function getGroups(): string[] {
  const seen: string[] = [];
  rules.coringas.forEach((rule) => {
    const group = rule.group.trim() || NO_GROUP_LABEL;
    if (!seen.includes(group)) seen.push(group);
  });
  return seen;
}

function renderGroupFilter(): void {
  const groups = getGroups();

  // se o filtro ativo não existe mais (grupo renomeado/removido), volta pra "Todos"
  if (activeGroupFilter && !groups.includes(activeGroupFilter)) {
    activeGroupFilter = null;
  }

  groupFilterContainer.innerHTML = '';

  if (groups.length < 2) {
    return; // não vale a pena filtrar com 0 ou 1 grupo só
  }

  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = 'group-filter-chip' + (activeGroupFilter === null ? ' active' : '');
  allChip.textContent = 'Todos';
  allChip.addEventListener('click', () => {
    activeGroupFilter = null;
    renderGroupFilter();
    renderCoringas();
  });
  groupFilterContainer.appendChild(allChip);

  groups.forEach((group) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'group-filter-chip' + (activeGroupFilter === group ? ' active' : '');
    chip.textContent = group;
    chip.addEventListener('click', () => {
      activeGroupFilter = group;
      renderGroupFilter();
      renderCoringas();
    });
    groupFilterContainer.appendChild(chip);
  });
}

function renderCoringas(): void {
  coringasContainer.innerHTML = '';

  const visible = rules.coringas.filter((rule) => {
    if (activeGroupFilter === null) return true;
    return (rule.group.trim() || NO_GROUP_LABEL) === activeGroupFilter;
  });

  if (visible.length > 0) {
    const header = document.createElement('div');
    header.className = 'coringa-row-header';
    header.innerHTML = '<span>Rótulo</span><span>Coringa</span><span>Grupo</span><span></span>';
    coringasContainer.appendChild(header);
  }

  visible.forEach((rule) => {
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
    renderGroupFilter();
    renderCoringas();
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-field';
  removeBtn.textContent = '✕';
  removeBtn.title = 'Remover';
  removeBtn.addEventListener('click', () => {
    rules.coringas = rules.coringas.filter((r) => r.id !== rule.id);
    persist();
    renderGroupFilter();
    renderCoringas();
  });

  row.append(labelInput, coringaInput, groupInput, removeBtn);
  return row;
}

btnAddCoringa.addEventListener('click', () => {
  const prefillGroup = activeGroupFilter && activeGroupFilter !== NO_GROUP_LABEL ? activeGroupFilter : '';
  rules.coringas.push({ id: newRuleId(), label: '', coringa: '', group: prefillGroup });
  persist();
  renderGroupFilter();
  renderCoringas();
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
    if (typeof parsed.customCss !== 'string') parsed.customCss = '';
    rules = mergeNewDefaults(parsed as RulesConfig);
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

function renderRulesEditor(): void {
  activeGroupFilter = null;
  renderBoldWords();
  renderGroupFilter();
  renderCoringas();
  inputCss.value = rules.customCss;
  renderCssOutput();
}

renderRulesEditor();
