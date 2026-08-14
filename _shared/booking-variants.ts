// 指名版 LP の variant → 予約対象アドバイザー（CRM 表示名）の対応表。
//
// なぜ中継層に置くか:
//   ブラウザ（index.html）が送るのは配信パス由来の variant スラッグだけで、
//   アドバイザー名は HTML に一切出さない。ここで解決することで、
//   URL を書き換えて任意の CA を指名することができない。
//
// CRM 側の扱い（src/lib/booking/advisors.ts）:
//   プールを迂回せず、プール（新卒＝is_booking_advisor かつ specialty_type='shinsotsu'）の
//   中から表示名が一致する 1 名に絞る。表示名の比較は空白を除去して行うため
//   '野村 拓矢' / '野村拓矢' のどちらの登録でも一致する。
//   一致しない（トグル OFF / 退職 / 改名）ときは母集団が空になり、枠が出ず予約も成立しない。
//   ＝「指名したのに別の CA が割り当たる」事故は起きない。
//
// 新しい指名版を足す手順:
//   1. ここに variant → CRM 表示名 を 1 行足す
//   2. vercel.json の rewrites に `/saitan/<variant>` を足す
//   3. CRM の「設定 > LP 管理 > saitan」に UTM 変種を足す（計測用、任意）

export const BOOKING_ADVISOR_BY_VARIANT: Record<string, string> = {
  nomuratakuya: '野村 拓矢',
  asamiyusuke: '浅見 友介',
};

/** variant スラッグを対応表で解決する。未知 / 未指定は null（＝通常のプール自動割当）。 */
export function resolveAdvisorName(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw === '') return null;
  return BOOKING_ADVISOR_BY_VARIANT[raw] ?? null;
}
