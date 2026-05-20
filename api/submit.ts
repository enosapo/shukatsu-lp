// LP 送信中継エンドポイント（Vercel Edge Function）
//
// 役割:
//   LP (https://shukatsu.enosapo.com/<lp>/) のフォーム送信を受け、
//   CRM API (/api/lp/intake) に転送する中継層。
//   旧 submit.php (Apache + PHP) の完全移植版。
//
// なぜ中継が必要か:
//   モバイル WebView (LINE / Instagram / X 等) が cross-origin POST を
//   弾く / キャンセルするケースがあるため、LP と同一オリジンの Edge
//   Function に POST させてサーバ間で CRM に転送する。
//   2026-05-07 の standard-a でモバイル LINE 経由 CV が全く到達しない
//   事象が発生した教訓を踏まえた構成。
//
// セキュリティ:
//   X-LP-Secret は LP 側 HTML に書かず、Vercel 環境変数に隔離。
//   Origin / Referer の自ドメイン照合を 1 段挟む（secret 漏洩時の二段目）。
//   モバイル WebView は両ヘッダが空になるケースあり → 空 (= 不明) は通す。
//
// saitan → 就活ボード ハンドオフ:
//   CRM intake が candidate_id を返したら、HMAC 署名した token を Set-Cookie で
//   shukatsu.enosapo.com 配下に保存。learning-board signup ページが読み出して
//   /api/signup の payload に含める → CRM 側 trigger が「board 情報優先」で
//   saitan candidate を上書きする。SAITAN_HANDOFF_SECRET 未設定なら無効化。

import { signHandoffToken } from '../_shared/handoff-token';

export const config = { runtime: 'edge' };

const UPSTREAM_URL = 'https://enovance-crm.vercel.app/api/lp/intake';

const HANDOFF_COOKIE_NAME = 'hk';
const HANDOFF_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 日

const ALLOWED_HOSTS = new Set([
  'shukatsu.enosapo.com',
  'enosapo.com',
  'www.enosapo.com',
  'localhost:3000',
  'localhost:3001',
]);

function hostInAllowed(url: string | null): boolean | null {
  if (!url) return null; // 不明 = 判定保留 (LINE / Instagram WebView 対策)
  try {
    const u = new URL(url);
    return ALLOWED_HOSTS.has(u.host);
  } catch {
    return false;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json(
      { result: 'error', message: 'method not allowed' },
      { status: 405 },
    );
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  if (hostInAllowed(origin) === false || hostInAllowed(referer) === false) {
    return Response.json(
      { result: 'error', message: 'forbidden origin' },
      { status: 403 },
    );
  }

  const payload = await req.text();
  if (!payload) {
    return Response.json(
      { result: 'error', message: 'no payload' },
      { status: 400 },
    );
  }

  const secret = process.env.LP_INTAKE_SECRET;
  if (!secret) {
    return Response.json(
      { result: 'error', message: 'server misconfigured' },
      { status: 500 },
    );
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LP-Secret': secret,
      },
      body: payload,
    });
  } catch (err) {
    return Response.json(
      { result: 'error', message: 'upstream error: ' + String(err) },
      { status: 502 },
    );
  }

  const body = await upstreamRes.text();

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  };

  // 成功時のみハンドオフ Cookie を発行。CRM が返した candidate_id を HMAC 署名 token に詰める。
  // SAITAN_HANDOFF_SECRET 未設定時は無音でスキップ（CV を止めない）。
  const handoffSecret = process.env.SAITAN_HANDOFF_SECRET;
  if (upstreamRes.ok && handoffSecret && body) {
    try {
      const parsed = JSON.parse(body) as { ok?: boolean; candidate_id?: string };
      if (parsed.ok && typeof parsed.candidate_id === 'string') {
        const token = await signHandoffToken(handoffSecret, parsed.candidate_id, HANDOFF_TTL_SECONDS);
        // Domain は shukatsu.enosapo.com に明示固定（/saitan/* と /board/* を共有）。
        // SameSite=Lax で同サブドメイン navigation 経由の送信を許可。
        // HttpOnly は付けない（board signup ページの JS が読む必要があるため）。
        responseHeaders['Set-Cookie'] =
          `${HANDOFF_COOKIE_NAME}=${token}; Domain=shukatsu.enosapo.com; Path=/; Max-Age=${HANDOFF_TTL_SECONDS}; Secure; SameSite=Lax`;
      }
    } catch {
      // body が JSON でない / candidate_id が無い場合は無音でスキップ
    }
  }

  return new Response(body || '{"result":"forwarded"}', {
    status: upstreamRes.status || 200,
    headers: responseHeaders,
  });
}
