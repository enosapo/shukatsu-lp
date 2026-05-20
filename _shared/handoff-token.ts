// saitan LP → 就活ボード のハンドオフ token 共通モジュール（署名側）。
//
// 設計:
//   - HMAC-SHA256 で署名した「candidate_id + exp」を Cookie に詰めて
//     shukatsu.enosapo.com 配下で共有する。
//   - 形式: `<base64url(JSON {cid, exp})>.<base64url(HMAC)>` （JWT-like）
//   - 検証側は shukatsu-board の /api/signup で同じ秘密鍵を共有して署名検証。
//   - Web Crypto API ベースなので Edge runtime でそのまま動く。
//
// 秘密鍵:
//   SAITAN_HANDOFF_SECRET（Vercel env、shukatsu-lp と shukatsu-board の両方に
//   同値を設定する）。未設定なら token 生成をスキップ（CV 自体は止めない）。

const ENC = new TextEncoder();

function base64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    ENC.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, ENC.encode(data));
  return new Uint8Array(sig);
}

/**
 * candidate_id を含む handoff token を生成する。
 * exp は Unix 秒。デフォルト 30 日。
 */
export async function signHandoffToken(
  secret: string,
  candidateId: string,
  ttlSeconds = 60 * 60 * 24 * 30,
): Promise<string> {
  const payload = {
    cid: candidateId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadB64 = base64urlEncode(ENC.encode(JSON.stringify(payload)));
  const sig = await hmacSha256(secret, payloadB64);
  return `${payloadB64}.${base64urlEncode(sig)}`;
}
