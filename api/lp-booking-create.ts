// 面談日程調整の「予約確定」中継エンドポイント（Vercel Edge Function / saitan 新卒プール）
//
// 役割:
//   saitan LP の日程調整ステップから呼ばれ、CRM の /api/lp-booking/create に
//   X-LP-Secret を付けて転送する中継層（submit.ts と同型）。
//   モバイル WebView の cross-origin POST 弾き対策も兼ねる。
//
//   ⚠️ pool='shinsotsu' をサーバー側で強制注入する（就活ボード予約対象アドバイザー＝新卒プール）。
//      ブラウザ送信ボディに別プールが入っていても上書きする（改ざん対策）。
//
// リクエスト: POST /api/lp-booking-create  Body: { candidate_id, date, slot }
// レスポンス: CRM のレスポンス（{ ok, ca_name, scheduled_at, meet_url, calendar_synced }）をそのまま返す

export const config = { runtime: 'edge' };

const UPSTREAM_URL = 'https://enovance-crm.vercel.app/api/lp-booking/create';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'method not allowed' }, { status: 405 });
  }

  const secret = process.env.LP_INTAKE_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: 'server misconfigured' }, { status: 500 });
  }

  const incoming = await req.text();
  if (!incoming) {
    return Response.json({ ok: false, error: 'no payload' }, { status: 400 });
  }

  // 新卒プールを強制注入する。JSON でない / 壊れたボディは 400。
  let payload: string;
  try {
    const obj = JSON.parse(incoming) as Record<string, unknown>;
    obj.pool = 'shinsotsu';
    payload = JSON.stringify(obj);
  } catch {
    return Response.json({ ok: false, error: 'invalid payload' }, { status: 400 });
  }

  try {
    const res = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LP-Secret': secret,
      },
      body: payload,
    });
    const body = await res.text();
    return new Response(body || '{"ok":false,"error":"empty_upstream"}', {
      status: res.status || 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return Response.json({ ok: false, error: 'upstream error: ' + String(err) }, { status: 502 });
  }
}
