import './style.css';
import { formatProspecto } from './formatter';
import { loadMapping, saveMapping, resetMapping, type MappingConfig } from './mappings';

let mapping: MappingConfig = loadMapping();

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

btnFormat.addEventListener('click', () => {
  const result = formatProspecto(inputText.value, mapping);
  outputHtml.value = result.html;
  outputPreview.innerHTML = result.html;

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

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- Mapeamento ----------
const sectionsContainer = document.getElementById('sections-container') as HTMLDivElement;
const btnAddSection = document.getElementById('btn-add-section') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import') as HTMLButtonElement;
const importFile = document.getElementById('import-file') as HTMLInputElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;

function renderMappingEditor(): void {
  sectionsContainer.innerHTML = '';

  for (const sectionTitle of Object.keys(mapping.sections)) {
    sectionsContainer.appendChild(buildSectionBlock(sectionTitle));
  }
  sectionsContainer.appendChild(buildSectionBlock(null, mapping.fallback, 'Fora de qualquer seção'));
}

function buildSectionBlock(
  sectionTitle: string | null,
  overrideFields?: Record<string, string | null>,
  fixedLabel?: string,
): HTMLDivElement {
  const isFallback = sectionTitle === null;
  const fields = overrideFields ?? mapping.sections[sectionTitle as string];

  const block = document.createElement('div');
  block.className = 'section-block';

  const header = document.createElement('div');
  header.className = 'section-block-header';

  if (isFallback) {
    const span = document.createElement('strong');
    span.textContent = fixedLabel ?? 'Fallback';
    header.appendChild(span);
  } else {
    const titleInput = document.createElement('input');
    titleInput.value = sectionTitle as string;
    titleInput.addEventListener('change', () => {
      const newTitle = titleInput.value.trim();
      if (!newTitle || newTitle === sectionTitle) {
        titleInput.value = sectionTitle as string;
        return;
      }
      const entries = Object.entries(mapping.sections);
      const newSections: MappingConfig['sections'] = {};
      for (const [key, value] of entries) {
        newSections[key === sectionTitle ? newTitle : key] = value;
      }
      mapping.sections = newSections;
      persistAndRerender();
    });
    header.appendChild(titleInput);

    const removeSectionBtn = document.createElement('button');
    removeSectionBtn.className = 'secondary small-btn';
    removeSectionBtn.textContent = 'Remover seção';
    removeSectionBtn.addEventListener('click', () => {
      delete mapping.sections[sectionTitle as string];
      persistAndRerender();
    });
    header.appendChild(removeSectionBtn);
  }

  block.appendChild(header);

  const fieldsWrap = document.createElement('div');
  for (const label of Object.keys(fields)) {
    fieldsWrap.appendChild(buildFieldRow(fields, label));
  }
  block.appendChild(fieldsWrap);

  const addFieldBtn = document.createElement('button');
  addFieldBtn.className = 'secondary small-btn';
  addFieldBtn.textContent = '+ Campo';
  addFieldBtn.addEventListener('click', () => {
    let newLabel = 'Novo campo';
    let i = 2;
    while (newLabel in fields) {
      newLabel = `Novo campo ${i++}`;
    }
    fields[newLabel] = null;
    persistAndRerender();
  });
  block.appendChild(addFieldBtn);

  return block;
}

function buildFieldRow(fields: Record<string, string | null>, label: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'field-row';

  const labelInput = document.createElement('input');
  labelInput.placeholder = 'Rótulo (ex: Nome)';
  labelInput.value = label;
  labelInput.addEventListener('change', () => {
    const newLabel = labelInput.value.trim();
    if (!newLabel || newLabel === label) {
      labelInput.value = label;
      return;
    }
    const value = fields[label];
    delete fields[label];
    fields[newLabel] = value;
    persistAndRerender();
  });

  const templateInput = document.createElement('input');
  templateInput.placeholder = 'Coringa (ex: {NOME_CLIENTE}) — vazio = manter valor digitado';
  templateInput.value = fields[label] ?? '';
  templateInput.addEventListener('change', () => {
    fields[label] = templateInput.value.trim() || null;
    saveMapping(mapping);
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-field';
  removeBtn.textContent = '✕';
  removeBtn.title = 'Remover campo';
  removeBtn.addEventListener('click', () => {
    delete fields[label];
    persistAndRerender();
  });

  row.append(labelInput, templateInput, removeBtn);
  return row;
}

function persistAndRerender(): void {
  saveMapping(mapping);
  renderMappingEditor();
}

btnAddSection.addEventListener('click', () => {
  let newTitle = 'NOVA SEÇÃO';
  let i = 2;
  while (newTitle in mapping.sections) {
    newTitle = `NOVA SEÇÃO ${i++}`;
  }
  mapping.sections[newTitle] = {};
  persistAndRerender();
});

btnExport.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(mapping, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mapeamento-prospecto.json';
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
    if (!parsed.sections || !parsed.fallback) throw new Error('formato inválido');
    mapping = parsed as MappingConfig;
    persistAndRerender();
  } catch (err) {
    alert('Não foi possível importar esse arquivo: ' + (err as Error).message);
  } finally {
    importFile.value = '';
  }
});

btnReset.addEventListener('click', () => {
  if (!confirm('Isso vai apagar suas alterações e voltar ao mapeamento padrão. Continuar?')) return;
  mapping = resetMapping();
  renderMappingEditor();
});

renderMappingEditor();
