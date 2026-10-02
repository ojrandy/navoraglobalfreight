import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireAdminAuth } from '../middleware/auth.js';

export const settingsRouter = Router();

// GET /api/settings — deliberately public (see server/index.ts): the public site reads
// companyName/supportPhone/dispatchEmail/headquartersAddress/dotNumber and display toggles
// like piiMaskingEnabled/mapVisibility/showEstimatedTime from here.
settingsRouter.get('/', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get('general') as any;
    const settings = row ? JSON.parse(row.value_json) : {};
    res.json({ success: true, data: settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings — admin only; the public site only ever reads this data.
settingsRouter.put('/', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const newSettings = req.body;
    const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get('general') as any;
    const current = row ? JSON.parse(row.value_json) : {};
    const merged = { ...current, ...newSettings };

    db.prepare('INSERT OR REPLACE INTO settings (key, value_json) VALUES (?, ?)').run('general', JSON.stringify(merged));
    res.json({ success: true, data: merged });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
