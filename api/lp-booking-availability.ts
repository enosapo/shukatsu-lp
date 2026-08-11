// 面談日程調整の「空き枠取得」中継エンドポイント（Vercel Edge Function / saitan 新卒プール）
//
// 役割:
//   saitan LP の日程調整ステップから呼ばれ、CRM の /api/lp-booking/availability に
//   X-LP-Secret を付けて転送する中継層（submit.ts と同型）。
//   LP ページ → 本関数（同一オリジン）→ CRM（サーバ間）なのでブラウザ CORS は発生しない。
//
//   ⚠️ pool=shinsotsu をサーバー側で固定する（就活ボード予約対象アドバイザー＝新卒プール）。
//      ブラウザから別プール（中途）を指定されても無視する（改ざん対策）。
//
// リクエスト: GET /api/lp-booking-availability?date=YYYY-MM-DD&slots=10:00,11:00,...
// レスポンス: { ok: true, available: ['10:00', ...] }（CRM のレスポンスをそのまま返す）

import { resolveAdvisorName } from '../_shared/booking-variants';

export const config = { runtime: 'edge' };

const UPSTREAM_URL = 'https://enovance-crm.vercel.app/api/lp-booking/availability';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return Response.json({ ok: false, error: 'method not allowed' }, { status: 405 });
  }

  const secret = process.env.LP_INTAKE_SECRET;
  if (!secret) {
    // 鍵未設定でも LP を壊さない（空き無し扱い＝予約スキップにフォールバック）
    return Response.json({ ok: true, available: [] }, { status: 200 });
  }

  const incoming = new URL(req.url);
  const date = incoming.searchParams.get('date') ?? '';
  const slots = incoming.searchParams.get('slots') ?? '';
  // 指名版 LP（/saitan/<variant>/）は variant → CRM 表示名をここで解決する。
  // 対応表に無い値は無視（＝通常のプール自動割当に戻る）。
  const advisorName = resolveAdvisorName(incoming.searchParams.get('variant'));

  const upstream = new URL(UPSTREAM_URL);
  if (date) upstream.searchParams.set('date', date);
  if (slots) upstream.searchParams.set('slots', slots);
  upstream.searchParams.set('pool', 'shinsotsu'); // 新卒プール固定
  if (advisorName) upstream.searchParams.set('advisor', advisorName);

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: { 'X-LP-Secret': secret },
    });
    const body = await res.text();
    return new Response(body || '{"ok":true,"available":[]}', {
      status: res.status || 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    // 取得失敗は空き無しで返す（CV を止めない）
    return Response.json({ ok: true, available: [] }, { status: 200 });
  }
}
