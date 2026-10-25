import type { RecordType } from './content-db';
import { integer, slugify, tags, text } from './validate';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'tags';

export type AdminField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  help?: string;
};

export type AdminSchema = {
  type: RecordType;
  label: string;
  slugField: string;
  titleField: string;
  fields: AdminField[];
};

const sortField: AdminField = { name: 'sortOrder', label: '排序（越小越靠前）', type: 'number' };

const schemas: Record<RecordType, AdminSchema> = {
  essays: {
    type: 'essays',
    label: '随笔',
    slugField: 'slug',
    titleField: 'title',
    fields: [
      { name: 'slug', label: 'slug（URL 用）', type: 'text', required: true },
      { name: 'title', label: '标题', type: 'text', required: true },
      { name: 'date', label: '日期', type: 'date', required: true },
      { name: 'category', label: '分类文案', type: 'text', required: true },
      {
        name: 'kind',
        label: '类型',
        type: 'select',
        required: true,
        options: [
          { value: 'essay', label: '随笔' },
          { value: 'micro', label: '碎碎念' },
        ],
      },
      { name: 'readMinutes', label: '阅读分钟', type: 'number' },
      { name: 'tags', label: '标签（逗号分隔）', type: 'tags' },
      { name: 'quote', label: '摘句', type: 'textarea' },
      { name: 'summary', label: '摘要', type: 'textarea', required: true },
      { name: 'body', label: '正文（HTML）', type: 'textarea', required: true },
      sortField,
    ],
  },
  books: {
    type: 'books',
    label: '书籍',
    slugField: 'slug',
    titleField: 'title',
    fields: [
      { name: 'slug', label: 'slug', type: 'text', required: true },
      { name: 'title', label: '书名', type: 'text', required: true },
      { name: 'author', label: '作者', type: 'text', required: true },
      { name: 'genre', label: '题材', type: 'text' },
      {
        name: 'status',
        label: '状态',
        type: 'select',
        options: [
          { value: 'reading', label: '在读' },
          { value: 'finished', label: '已读完' },
          { value: 'paused', label: '暂停' },
        ],
      },
      { name: 'year', label: '年份', type: 'number' },
      { name: 'cover', label: '封面地址', type: 'text' },
      { name: 'url', label: '外链地址', type: 'text' },
      { name: 'blurb', label: '简介', type: 'textarea' },
      {
        name: 'category',
        label: '筛选分类',
        type: 'select',
        options: [
          { value: 'webnovel', label: '玄幻奇幻' },
          { value: 'suspense', label: '悬疑志怪' },
        ],
      },
      { name: 'words', label: '字数 / 进度说明', type: 'text' },
      { name: 'progress', label: '阅读进度', type: 'text' },
      { name: 'quote', label: '摘句', type: 'textarea' },
      { name: 'footer', label: '卡片底部注记', type: 'text' },
      { name: 'featured', label: '首页精选', type: 'checkbox' },
      sortField,
    ],
  },
  albums: {
    type: 'albums',
    label: '唱片',
    slugField: 'slug',
    titleField: 'title',
    fields: [
      { name: 'slug', label: 'slug', type: 'text', required: true },
      { name: 'title', label: '专辑名', type: 'text', required: true },
      { name: 'artist', label: '歌手 / 说明', type: 'text' },
      { name: 'cover', label: '封面地址', type: 'text' },
      { name: 'tag', label: '标签', type: 'text' },
      { name: 'label', label: '角标', type: 'text' },
      sortField,
    ],
  },
  tracks: {
    type: 'tracks',
    label: '曲目',
    slugField: 'slug',
    titleField: 'title',
    fields: [
      { name: 'slug', label: 'slug', type: 'text', required: true },
      { name: 'title', label: '曲名', type: 'text', required: true },
      { name: 'artist', label: '歌手', type: 'text' },
      { name: 'album', label: '专辑', type: 'text' },
      { name: 'cover', label: '封面地址', type: 'text' },
      { name: 'tag', label: '标签', type: 'text' },
      { name: 'duration', label: '时长（mm:ss）', type: 'text' },
      { name: 'audio', label: '本地音频地址（可选）', type: 'text' },
      { name: 'url', label: '外部链接（可选）', type: 'text' },
      { name: 'note', label: '备注', type: 'text' },
      { name: 'repeat', label: '单曲循环', type: 'checkbox' },
      { name: 'albumSlug', label: '所属专辑 slug', type: 'text' },
      { name: 'kugouHash', label: '酷狗 hash', type: 'text', help: '填了才会进入站内播放白名单' },
      { name: 'kugouAlbumId', label: '酷狗 albumId', type: 'text' },
      { name: 'kugouAlbumAudioId', label: '酷狗 albumAudioId', type: 'number' },
      sortField,
    ],
  },
  quotes: {
    type: 'quotes',
    label: '台词',
    slugField: 'id',
    titleField: 'text',
    fields: [
      { name: 'id', label: 'ID（英文/数字/-）', type: 'text', required: true },
      { name: 'text', label: '摘句正文', type: 'textarea', required: true },
      { name: 'source', label: '出处', type: 'text', required: true },
      { name: 'work', label: '作品 / 分类', type: 'text' },
      { name: 'date', label: '日期', type: 'date' },
      { name: 'tags', label: '标签（逗号分隔）', type: 'tags' },
      sortField,
    ],
  },
  links: {
    type: 'links',
    label: '友链',
    slugField: 'slug',
    titleField: 'title',
    fields: [
      { name: 'slug', label: 'slug', type: 'text', required: true },
      { name: 'title', label: '站名', type: 'text', required: true },
      { name: 'note', label: '一句话简介', type: 'text' },
      { name: 'tag', label: '右侧标签', type: 'text' },
      { name: 'url', label: '网址（留空则暂链回友链区）', type: 'text' },
      sortField,
    ],
  },
};

export const ADMIN_SCHEMAS = Object.values(schemas);

export function getAdminSchema(type: string): AdminSchema | null {
  return (schemas as Record<string, AdminSchema>)[type] ?? null;
}

export type ParsedContentRecord = {
  slug: string;
  title: string;
  data: Record<string, unknown>;
  sortOrder: number;
};

export function parseContentInput(
  type: string,
  body: Record<string, unknown>,
): { ok: true; value: ParsedContentRecord } | { ok: false; error: string } {
  const schema = getAdminSchema(type);
  if (!schema) return { ok: false, error: '未知内容类型' };

  const data: Record<string, unknown> = {};
  let slugValue = '';
  let titleValue = '';

  for (const field of schema.fields) {
    const raw = body[field.name];
    if (field.name === 'sortOrder') continue;

    if (field.type === 'checkbox') {
      data[field.name] = raw === true || raw === 'true' || raw === 'on' || raw === 1;
      continue;
    }
    if (field.type === 'tags') {
      data[field.name] = tags(raw);
      continue;
    }
    if (field.type === 'number') {
      data[field.name] = integer(raw, 0, 0, 100000);
      continue;
    }
    if (field.type === 'select') {
      const value = text(raw, 40);
      if (field.required && !field.options?.some((option) => option.value === value)) {
        return { ok: false, error: `${field.label}缺少或取值不合法` };
      }
      if (value) data[field.name] = value;
      continue;
    }

    const value = text(raw, field.type === 'textarea' ? 20000 : 500);
    if (field.required && !value) return { ok: false, error: `缺少${field.label}` };
    if (value) data[field.name] = value;

    if (field.name === schema.slugField) slugValue = value;
    if (field.name === schema.titleField) titleValue = value;
  }

  // 曲目的 kugou 元数据从扁平表单字段还原成对象。
  if (type === 'tracks') {
    const hash = text(body.kugouHash, 80);
    const albumId = text(body.kugouAlbumId, 40);
    const albumAudioId = integer(body.kugouAlbumAudioId, 0, 0, 1000000000);
    if (hash) {
      data.kugou = { hash: hash.toLowerCase(), albumId: albumId || '0', albumAudioId };
    } else {
      delete data.kugou;
    }
    delete data.kugouHash;
    delete data.kugouAlbumId;
    delete data.kugouAlbumAudioId;
  }

  const slug = slugify(slugValue, `${type}-${Date.now().toString(36)}`);
  data[schema.slugField] = slug;

  if (schema.titleField === 'text' && typeof data.text === 'string') {
    titleValue = data.text;
  }
  if (!titleValue) titleValue = slug;

  return {
    ok: true,
    value: {
      slug,
      title: titleValue.slice(0, 200),
      data,
      sortOrder: integer(body.sortOrder, 0, 0, 100000),
    },
  };
}
