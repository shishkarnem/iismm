import { Router, Request, Response } from 'express';
import { getPgDB, normalizeUserId, savePgDB } from '../db/postgres';
import {
  getAllTariffsAdminFromDb,
  getAllTariffsFromDb,
  createOrUpdateTariffInDb,
  getTariffById
} from '../db/tariffsTable';
import { getPricingConfig, updatePricingConfigInDb } from './pricingService';

export function registerPricingRoutes(router: Router): void {
  router.get('/pricing', async (req: Request, res: Response) => {
    try {
      const db = await getPgDB();
      const rawUid = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
      const cleanUid = rawUid ? normalizeUserId(rawUid) : undefined;
      const pricing = await getPricingConfig(db);
      const tariffs = getAllTariffsFromDb(db, cleanUid).map((t) => ({
        ...t,
        is_custom: Number(t.is_custom || 0),
        is_active: Number(t.is_active ?? 1),
        duration_days: Number(t.duration_days || 30),
        features: typeof t.features === 'string' ? JSON.parse(t.features || '[]') : t.features
      }));
      res.json({ success: true, pricing, tariffs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Ошибка чтения конфигурации цен' });
    }
  });

  router.get('/admin/pricing', async (_req: Request, res: Response) => {
    try {
      const db = await getPgDB();
      const pricing = await getPricingConfig(db);
      const tariffs = getAllTariffsAdminFromDb(db).map((t) => ({
        ...t,
        is_custom: Number(t.is_custom || 0),
        is_active: Number(t.is_active ?? 1),
        duration_days: Number(t.duration_days || 30),
        features: typeof t.features === 'string' ? JSON.parse(t.features || '[]') : t.features
      }));
      res.json({ success: true, pricing, tariffs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Ошибка чтения цен для админки' });
    }
  });

  const handleSavePricing = async (req: Request, res: Response) => {
    try {
      const db = await getPgDB();
      const incoming = req.body?.pricing || req.body || {};
      const updated = updatePricingConfigInDb(db, incoming);
      savePgDB();
      res.json({
        success: true,
        pricing: updated,
        message: 'Цены и стоимость ИИрок сохранены (прежние покупки и списания не изменены).'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Ошибка сохранения цен' });
    }
  };

  router.put('/admin/pricing', handleSavePricing);
  router.post('/admin/pricing', handleSavePricing);

  router.put(['/tariffs/:id', '/admin/tariffs/:id'], async (req: Request, res: Response) => {
    try {
      const tariffId = String(req.params.id || '').trim();
      const db = await getPgDB();
      const existing = getTariffById(db, tariffId);
      const body = req.body || {};
      const mergedName = String(body.name ?? existing?.name ?? '').trim();
      if (!mergedName) {
        res.status(400).json({ success: false, error: 'Название тарифа обязательно' });
        return;
      }

      const saved = createOrUpdateTariffInDb(db, {
        id: existing?.id || tariffId,
        name: mergedName,
        price_rub: body.price_rub !== undefined ? Number(body.price_rub) : existing?.price_rub ?? 0,
        monthly_iirky: body.monthly_iirky !== undefined ? Number(body.monthly_iirky) : existing?.monthly_iirky ?? 0,
        price_iirky: body.price_iirky !== undefined ? String(body.price_iirky) : existing?.price_iirky,
        sub: body.sub !== undefined ? String(body.sub) : existing?.sub,
        continuation: body.continuation !== undefined ? String(body.continuation) : existing?.continuation,
        features: body.features !== undefined ? body.features : existing?.features,
        is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing?.is_active ?? 1,
        sort_order: body.sort_order !== undefined ? Number(body.sort_order) : existing?.sort_order ?? 10,
        duration_days: body.duration_days !== undefined ? Number(body.duration_days) : existing?.duration_days ?? 30,
        duration_text: body.duration_text !== undefined ? String(body.duration_text) : existing?.duration_text,
        discount_3m: body.discount_3m !== undefined ? Number(body.discount_3m) : existing?.discount_3m ?? 10,
        discount_6m: body.discount_6m !== undefined ? Number(body.discount_6m) : existing?.discount_6m ?? 15,
        discount_12m: body.discount_12m !== undefined ? Number(body.discount_12m) : existing?.discount_12m ?? 20,
        target_user_id: body.target_user_id !== undefined ? body.target_user_id : existing?.target_user_id,
        is_custom: body.is_custom !== undefined ? (body.is_custom ? 1 : 0) : existing?.is_custom
      });

      savePgDB();
      res.json({
        success: true,
        tariff: {
          ...saved,
          features: typeof saved.features === 'string' ? JSON.parse(saved.features || '[]') : saved.features
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Ошибка обновления тарифа' });
    }
  });
}
