import { Router } from 'express';
import { getPgDB, savePgDB } from '../db/postgres';
import { ACADEMY_SECTIONS, AcademyArticle } from './academyTypes';

function parseJsonArray<T>(raw: any, fallback: T[] = []): T[] {
  if (!raw) return fallback;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function rowToArticle(row: Record<string, any>): AcademyArticle {
  const secSlug = String(row.section_slug || 'profile-channels-teams');
  const foundSec = ACADEMY_SECTIONS.find(s => s.slug === secSlug);
  return {
    id: String(row.id || ''),
    sectionSlug: secSlug,
    sectionTitle: String(row.section_title || foundSec?.title || 'Академия'),
    title: String(row.title || 'Без названия'),
    summary: String(row.summary || ''),
    content: String(row.content || ''),
    formatMode: row.format_mode === 'v2' ? 'v2' : 'rich',
    attachmentUrl: String(row.attachment_url || ''),
    attachmentUrls: parseJsonArray<string>(row.attachment_urls, []),
    inlineButtons: parseJsonArray<any[]>(row.inline_buttons, []),
    sortOrder: Number(row.sort_order ?? 1),
    isPublished: row.is_published !== 0 && row.is_published !== false && row.is_published !== '0',
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString())
  };
}

export function initAcademyTable(_db: any) {
  // Data is persisted in cloud PostgreSQL ProTalk (iismm2); startup seeding removed.
}

export async function queryAcademyArticles(options?: {
  sectionSlug?: string;
  includeDrafts?: boolean;
}): Promise<AcademyArticle[]> {
  const db = await getPgDB();
  initAcademyTable(db);

  const clauses: string[] = [];
  const params: any[] = [];

  if (options?.sectionSlug && options.sectionSlug !== 'all') {
    clauses.push('section_slug = ?');
    params.push(options.sectionSlug);
  }
  if (!options?.includeDrafts) {
    clauses.push('is_published != 0');
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const stmt = db.prepare(
    `SELECT * FROM academy_articles ${whereSql} ORDER BY sort_order ASC, created_at ASC`
  );
  if (params.length > 0) {
    stmt.bind(params);
  }

  const rows: AcademyArticle[] = [];
  while (stmt.step()) {
    rows.push(rowToArticle(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}

export function registerAcademyRoutes(router: Router) {
  // Public & cabinet read endpoint
  router.get('/academy/articles', async (req, res) => {
    try {
      const sectionSlug = typeof req.query.section === 'string' ? req.query.section.trim() : undefined;
      const includeDrafts = req.query.includeDrafts === 'true' || req.query.includeDrafts === '1';
      const articles = await queryAcademyArticles({ sectionSlug, includeDrafts });
      res.json({
        success: true,
        sections: ACADEMY_SECTIONS,
        articles
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Ошибка загрузки материалов Академии' });
    }
  });

  // Admin create article
  router.post('/admin/academy/articles', async (req, res) => {
    try {
      const db = await getPgDB();
      initAcademyTable(db);

      const {
        sectionSlug = 'profile-channels-teams',
        title,
        summary = '',
        content = '',
        formatMode = 'rich',
        attachmentUrl = '',
        attachmentUrls = [],
        inlineButtons = [],
        sortOrder,
        isPublished = true
      } = req.body || {};

      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Укажите заголовок статьи Академии' });
      }

      const secMeta = ACADEMY_SECTIONS.find(s => s.slug === sectionSlug) || ACADEMY_SECTIONS[0];
      const now = new Date().toISOString();
      const id = `acad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      let computedOrder = Number(sortOrder);
      if (isNaN(computedOrder) || computedOrder <= 0) {
        const maxRes = db.exec(
          `SELECT COALESCE(MAX(sort_order), 0) FROM academy_articles WHERE section_slug = '${secMeta.slug.replace(/[^a-z0-9-]/gi, '')}'`
        );
        computedOrder = Number(maxRes?.[0]?.values?.[0]?.[0] || 0) + 1;
      }

      db.run(
        `INSERT INTO academy_articles (
          id, section_slug, section_title, title, summary, content,
          format_mode, attachment_url, attachment_urls, inline_buttons,
          sort_order, is_published, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          secMeta.slug,
          secMeta.title,
          String(title).trim(),
          String(summary || '').trim(),
          String(content || ''),
          formatMode === 'v2' ? 'v2' : 'rich',
          String(attachmentUrl || '').trim(),
          JSON.stringify(Array.isArray(attachmentUrls) ? attachmentUrls : []),
          JSON.stringify(Array.isArray(inlineButtons) ? inlineButtons : []),
          computedOrder,
          isPublished === false ? 0 : 1,
          now,
          now
        ]
      );

      savePgDB();

      const articles = await queryAcademyArticles({ includeDrafts: true });
      const created = articles.find(a => a.id === id);
      res.json({ success: true, article: created, articles });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Ошибка создания статьи Академии' });
    }
  });

  // Admin update article
  router.put('/admin/academy/articles/:id', async (req, res) => {
    try {
      const db = await getPgDB();
      initAcademyTable(db);

      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Не указан идентификатор статьи' });
      }

      const existingStmt = db.prepare('SELECT * FROM academy_articles WHERE id = ? LIMIT 1');
      existingStmt.bind([id]);
      const found = existingStmt.step() ? rowToArticle(existingStmt.getAsObject()) : null;
      existingStmt.free();

      if (!found) {
        return res.status(404).json({ error: 'Статья Академии не найдена' });
      }

      const body = req.body || {};
      const nextSlug = body.sectionSlug ? String(body.sectionSlug) : found.sectionSlug;
      const secMeta = ACADEMY_SECTIONS.find(s => s.slug === nextSlug) || ACADEMY_SECTIONS[0];
      const nextTitle = body.title !== undefined ? String(body.title).trim() : found.title;
      if (!nextTitle) {
        return res.status(400).json({ error: 'Заголовок статьи не может быть пустым' });
      }

      const nextSummary = body.summary !== undefined ? String(body.summary).trim() : found.summary;
      const nextContent = body.content !== undefined ? String(body.content) : found.content;
      const nextFormat = body.formatMode !== undefined ? (body.formatMode === 'v2' ? 'v2' : 'rich') : found.formatMode;
      const nextAttUrl = body.attachmentUrl !== undefined ? String(body.attachmentUrl).trim() : found.attachmentUrl;
      const nextAttUrls = body.attachmentUrls !== undefined
        ? (Array.isArray(body.attachmentUrls) ? body.attachmentUrls : [])
        : found.attachmentUrls;
      const nextBtns = body.inlineButtons !== undefined
        ? (Array.isArray(body.inlineButtons) ? body.inlineButtons : [])
        : found.inlineButtons;
      const nextOrder = body.sortOrder !== undefined ? Number(body.sortOrder) : found.sortOrder;
      const nextPublished = body.isPublished !== undefined ? Boolean(body.isPublished) : found.isPublished;
      const now = new Date().toISOString();

      db.run(
        `UPDATE academy_articles
         SET section_slug = ?, section_title = ?, title = ?, summary = ?, content = ?,
             format_mode = ?, attachment_url = ?, attachment_urls = ?, inline_buttons = ?,
             sort_order = ?, is_published = ?, updated_at = ?
         WHERE id = ?`,
        [
          secMeta.slug,
          secMeta.title,
          nextTitle,
          nextSummary,
          nextContent,
          nextFormat,
          nextAttUrl,
          JSON.stringify(nextAttUrls),
          JSON.stringify(nextBtns),
          isNaN(nextOrder) ? found.sortOrder : nextOrder,
          nextPublished ? 1 : 0,
          now,
          id
        ]
      );

      savePgDB();

      const articles = await queryAcademyArticles({ includeDrafts: true });
      const updated = articles.find(a => a.id === id);
      res.json({ success: true, article: updated, articles });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Ошибка сохранения статьи Академии' });
    }
  });

  // Admin delete article
  router.delete('/admin/academy/articles/:id', async (req, res) => {
    try {
      const db = await getPgDB();
      initAcademyTable(db);
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Не указан идентификатор статьи' });
      }
      db.run('DELETE FROM academy_articles WHERE id = ?', [id]);
      savePgDB();
      const articles = await queryAcademyArticles({ includeDrafts: true });
      res.json({ success: true, articles });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Ошибка удаления статьи Академии' });
    }
  });

  // Admin reorder articles
  router.post('/admin/academy/reorder', async (req, res) => {
    try {
      const db = await getPgDB();
      initAcademyTable(db);
      const orderedIds: string[] = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [];
      orderedIds.forEach((artId, idx) => {
        if (artId) {
          db.run('UPDATE academy_articles SET sort_order = ?, updated_at = ? WHERE id = ?', [
            idx + 1,
            new Date().toISOString(),
            String(artId)
          ]);
        }
      });
      savePgDB();
      const articles = await queryAcademyArticles({ includeDrafts: true });
      res.json({ success: true, articles });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Ошибка сортировки статей Академии' });
    }
  });
}
