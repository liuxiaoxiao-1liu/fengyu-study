// 后台「随笔 / 书架 / 唱片 / 曲目 / 台词 / 友链」通用内容编辑。
import { $, localToday, request, setText } from './dom';

type AdminField = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'tags';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  help?: string;
};
type AdminSchema = { type: string; label: string; slugField: string; titleField: string; fields: AdminField[] };
type ContentRecord = { id: string; slug: string; title: string; data: Record<string, unknown> };

const recordsTitle = $('records-title');
const recordForm = $<HTMLFormElement>('record-form');
const recordFormTitle = $('record-form-title');
const recordId = $<HTMLInputElement>('record-id');
const recordFields = $('record-fields');
const recordStatus = $('record-status');
const recordDelete = $<HTMLButtonElement>('record-delete');
const recordList = $('record-list');
const recordCount = $('record-count');
const recordListTitle = $('record-list-title');

let schemas: AdminSchema[] = [];
let activeType = 'photos';
let activeSchema: AdminSchema | null = null;
let contentRecords: ContentRecord[] = [];

function fieldInputId(name: string) {
  return `record-field-${name}`;
}

function setRecordStatus(message: string) {
  setText(recordStatus, message);
}

function fillRecordForm(record: ContentRecord | null) {
  if (!activeSchema || !recordFields) return;
  recordFields.replaceChildren();
  for (const field of activeSchema.fields) {
    const label = document.createElement('label');
    label.className = 'flex flex-col gap-1 font-label-sm text-label-sm text-on-surface-variant';
    if (field.type === 'textarea') label.classList.add('sm:col-span-2');
    label.textContent = field.required ? `${field.label} *` : field.label;

    let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'field min-h-[7rem]';
      input.value = String((record?.data[field.name] as string | undefined) ?? '');
    } else if (field.type === 'select') {
      input = document.createElement('select');
      input.className = 'field';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = field.required ? '请选择' : '（不填）';
      input.append(blank);
      for (const option of field.options ?? []) {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        input.append(node);
      }
      input.value = String((record?.data[field.name] as string | undefined) ?? '');
      if (!input.value && field.required) input.value = field.options?.[0]?.value ?? '';
    } else if (field.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'h-4 w-4 accent-secondary';
      input.checked = Boolean(record?.data[field.name]);
    } else if (field.type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
      input.className = 'field';
      input.value = String((record?.data[field.name] as number | undefined) ?? 0);
    } else if (field.type === 'date') {
      input = document.createElement('input');
      input.type = 'date';
      input.className = 'field';
      input.value = String((record?.data[field.name] as string | undefined) ?? localToday());
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'field';
      let value = record?.data[field.name];
      if (activeType === 'tracks' && field.name === 'kugouHash') {
        value = (record?.data.kugou as { hash?: string } | undefined)?.hash;
      } else if (activeType === 'tracks' && field.name === 'kugouAlbumId') {
        value = (record?.data.kugou as { albumId?: string } | undefined)?.albumId;
      } else if (activeType === 'tracks' && field.name === 'kugouAlbumAudioId') {
        value = (record?.data.kugou as { albumAudioId?: number } | undefined)?.albumAudioId;
      }
      if (field.type === 'tags' && Array.isArray(value)) value = (value as string[]).join(', ');
      input.value = String(value ?? '');
      if (field.type === 'tags') input.placeholder = '用逗号分隔';
      if (field.help) input.title = field.help;
    }
    input.id = fieldInputId(field.name);
    input.required = Boolean(field.required);
    if (field.type === 'number') input.setAttribute('step', '1');
    label.append(input);
    recordFields.append(label);
  }
  if (recordId) recordId.value = record?.id ?? '';
  setText(recordFormTitle, record ? `编辑${activeSchema.label}` : `新增${activeSchema.label}`);
  recordDelete?.classList.toggle('hidden', !record);
  setRecordStatus('');
}

function collectRecord() {
  const payload: Record<string, unknown> = {};
  if (!activeSchema) return payload;
  for (const field of activeSchema.fields) {
    const input = document.getElementById(fieldInputId(field.name)) as
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!input) continue;
    if (field.type === 'checkbox') {
      payload[field.name] = (input as HTMLInputElement).checked;
    } else if (field.type === 'number') {
      payload[field.name] = Number((input as HTMLInputElement).value || 0);
    } else {
      payload[field.name] = (input as HTMLInputElement).value;
    }
  }
  return payload;
}

function resetRecordForm() {
  fillRecordForm(null);
}

async function loadRecords() {
  if (!activeSchema || !recordList) return;
  recordList.replaceChildren();
  setRecordStatus('加载中…');
  try {
    const data = await request(`/api/admin/content/${activeSchema.type}`);
    contentRecords = data.records;
    setText(recordCount, `(${contentRecords.length})`);
    setText(recordListTitle, `${activeSchema.label}列表`);
    for (const record of contentRecords) {
      const row = document.createElement('div');
      row.className =
        'flex items-center justify-between gap-2 rounded-lg border border-surface-container-high bg-surface-container-low px-3 py-2';
      const meta = document.createElement('div');
      meta.className = 'min-w-0';
      const title = document.createElement('strong');
      title.className = 'block truncate text-sm text-primary';
      title.textContent = record.title;
      const slug = document.createElement('span');
      slug.className = 'block truncate font-label-sm text-[0.625rem] text-on-surface-variant';
      slug.textContent = record.slug;
      meta.append(title, slug);
      const actions = document.createElement('div');
      actions.className = 'flex shrink-0 items-center gap-2';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'text-xs text-secondary hover:text-primary';
      edit.textContent = '编辑';
      edit.addEventListener('click', () => fillRecordForm(record));
      actions.append(edit);
      row.append(meta, actions);
      recordList.append(row);
    }
    setRecordStatus('');
  } catch (error) {
    setRecordStatus(error instanceof Error ? error.message : '加载失败');
  }
}

export async function loadSchemas() {
  if (schemas.length) return;
  try {
    const data = await request('/api/admin/schema');
    schemas = data.schemas;
  } catch (error) {
    setRecordStatus(error instanceof Error ? error.message : '加载内容类型失败');
  }
}

export async function showRecords(type: string) {
  activeType = type;
  await loadSchemas();
  activeSchema = schemas.find((schema) => schema.type === type) ?? null;
  setText(recordsTitle, activeSchema?.label ?? type);
  fillRecordForm(null);
  await loadRecords();
}

export function initRecords() {
  $('record-refresh')?.addEventListener('click', () => void loadRecords());
  $('record-new')?.addEventListener('click', resetRecordForm);
  $('record-reset')?.addEventListener('click', resetRecordForm);

  recordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activeSchema) return;
    setRecordStatus('保存中…');
    const payload = collectRecord();
    try {
      const id = recordId?.value;
      if (id) {
        await request(`/api/admin/content/${activeSchema.type}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await request(`/api/admin/content/${activeSchema.type}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setRecordStatus('已保存');
      resetRecordForm();
      await loadRecords();
    } catch (error) {
      setRecordStatus(error instanceof Error ? error.message : '保存失败');
    }
  });

  recordDelete?.addEventListener('click', async () => {
    if (!activeSchema || !recordId?.value) return;
    if (!window.confirm('确定删除这条内容吗？')) return;
    try {
      await request(`/api/admin/content/${activeSchema.type}/${encodeURIComponent(recordId.value)}`, {
        method: 'DELETE',
      });
      resetRecordForm();
      await loadRecords();
      setRecordStatus('已删除');
    } catch (error) {
      setRecordStatus(error instanceof Error ? error.message : '删除失败');
    }
  });
}
