import type { APIRoute } from 'astro';
import { adminGuard, json } from './_utils';
import { listLettersForExport } from '../../../lib/guestbook-db';
import { listSubscribers } from '../../../lib/newsletter-db';

export const prerender = false;

const KINDS = new Set(['letters', 'subscribers']);
const FORMATS = new Set(['json', 'csv']);

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Excel 打开中文 CSV 需要 BOM，否则会认成 GBK。 */
function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function attachmentHeaders(contentType: string, filename: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export const GET: APIRoute = async ({ request, url }) => {
  const denied = adminGuard(request);
  if (denied) return denied;

  const kind = url.searchParams.get('kind') ?? 'letters';
  const format = (url.searchParams.get('format') ?? 'json').toLowerCase();

  if (!KINDS.has(kind)) {
    return json({ ok: false, error: 'invalid_kind' }, 400);
  }
  if (!FORMATS.has(format)) {
    return json({ ok: false, error: 'invalid_format' }, 400);
  }

  try {
    if (kind === 'letters') {
      const letters = listLettersForExport();

      if (format === 'json') {
        const payload = {
          ok: true,
          kind,
          exportedAt: new Date().toISOString(),
          count: letters.length,
          letters,
        };
        return new Response(JSON.stringify(payload, null, 2), {
          status: 200,
          headers: attachmentHeaders(
            'application/json; charset=utf-8',
            `fengyu-letters-${stamp()}.json`,
          ),
        });
      }

      const csv = toCsv(
        [
          'id',
          'name',
          'station',
          'message',
          'tag',
          'is_private',
          'status',
          'reply',
          'replied_at',
          'created_at',
        ],
        letters.map((letter) => [
          letter.id,
          letter.name,
          letter.station,
          letter.message,
          letter.tag,
          letter.is_private,
          letter.status,
          letter.reply,
          letter.replied_at ?? '',
          letter.created_at,
        ]),
      );
      return new Response(csv, {
        status: 200,
        headers: attachmentHeaders('text/csv; charset=utf-8', `fengyu-letters-${stamp()}.csv`),
      });
    }

    const subscribers = listSubscribers();

    if (format === 'json') {
      const payload = {
        ok: true,
        kind,
        exportedAt: new Date().toISOString(),
        count: subscribers.length,
        subscribers,
      };
      return new Response(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: attachmentHeaders(
          'application/json; charset=utf-8',
          `fengyu-subscribers-${stamp()}.json`,
        ),
      });
    }

    const csv = toCsv(
      ['email', 'created_at', 'source', 'confirmed'],
      subscribers.map((subscriber) => [
        subscriber.email,
        subscriber.created_at,
        subscriber.source,
        subscriber.confirmed,
      ]),
    );
    return new Response(csv, {
      status: 200,
      headers: attachmentHeaders('text/csv; charset=utf-8', `fengyu-subscribers-${stamp()}.csv`),
    });
  } catch (error) {
    console.error('[admin/export] GET failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};
