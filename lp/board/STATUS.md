# shukatsu-board LP — STATUS

## 概要

- **LP 名**: shukatsu-board（就活ボード集客 LP）
- **配置**: `marketing/shukatsu/lp/lp/board/`（既存 `enosapo/shukatsu-lp` repo の中、`/lp/<lp名>/` 配下に統一）
- **想定 URL**: `https://shukatsu.enosapo.com/lp/board/`（2026-05-18 確定。`/shukatsu-board/` ではなく `/lp/board/`）
- **CV 地点**: `https://shukatsu.enosapo.com/board/signup` への遷移（フォーム無し、CRM intake 連携無し）
- **ベース**: saitan LP（2026-05-16 複製）
- **作成日**: 2026-05-17

## 現状

- `index.html`: saitan のレイアウトを流用。Board セクションの 4 ステップウィザードを撤去し、`<a class="btn-submit">無料で使ってみる</a>` → `/board/signup` の単一 CTA カードに置換
- **コピー shukatsu-board 化済**:
  - Header tagline: 「新卒生のための / 就活管理ツール」
  - Hero heading: 「就活を、ひとつに。」
  - Hero sub: 「応募企業の選考管理・面接日程・タスクをひとつのボードで完結」
  - Ribbon: 「登録30秒・完全無料で使い放題」
  - Board タイトル: 「就活ボードをはじめる / 選考管理から面接対策まで、ボードひとつで完結します。」
  - title / meta description / og: shukatsu-board 向け
- **Laurel 撤去済**: saitan の数値（平均21日 / 3,200名 / 内定率91%）は誤情報になるため HTML コメントアウト。実数値確定後に復活
- **GTM 撤去済**: saitan 用コンテナ ID `GTM-PZT6M6BK` をコメントアウト。shukatsu-board 用 ID 発行後にコメントイン
- `assets/`: saitan の hero-bg.jpg / laurel-01〜03.svg / bubble.svg 等を流用（hero-bg.jpg はそのまま）
- `thanks.html`: 削除済（CV がリンク遷移なので不要）
- フォーム送信 JS / `intake-payload.js` 依存 / `LP_SOURCE` / `APPLICATION_ID_PREFIX` は撤去済
- 流入クエリ（utm_* 等）はクリック時に遷移先 URL に引き継ぐ最小 JS のみ残置

## 残 TODO（オーナー判断が必要なもの）

| 項目 | 内容 |
|---|---|
| **Hero 画像の差し替え** | hero-bg.jpg は saitan の人材紹介イメージのまま。プロダクト UI スクショ / 学生イメージ / Figma デザインに差し替え要 |
| **Laurel の実数値** | 撤去状態。登録者数 / 利用継続率 / 内定率 等の実数値が確定したら HTML コメントを外して復活（laurel-0X.svg のテキスト焼き込み数値の差し替えも必要） |
| **GTM コンテナ ID** | shukatsu-board 用 GTM コンテナを発行し、`GTM-XXXXXXX` プレースホルダを置換してコメントイン |
| **Hero 内 CTA ボタン** | 現状 CTA は Board セクションのみ。ファーストビュー直下にも CTA を置くか要検討 |
| **CRM 連携の要否** | 現方針は signup 遷移のみ（intake 無し）。将来「相談したい人はこちら」サブ CV を足すなら `crm_physical_lps` / `crm_lps` への seed migration が必要 |
| **OG 画像** | meta og:image 未設定 |
| **Vercel デプロイ確認** | `enosapo/shukatsu-lp` repo に push 後、`shukatsu.enosapo.com/lp/board/` で配信されるか実機確認 |

## デプロイ手順（既存 shukatsu-lp repo 内なので追加設定不要）

```bash
cd ~/.company/marketing/shukatsu/lp
git add lp/board/
git commit -m "feat: shukatsu-board 集客 LP 追加 (/lp/board/)"
git push origin main
```

→ Vercel が自動デプロイ。`shukatsu-board` (web) 側で `next.config.ts` の `rewrites().beforeFiles` に `/lp/board/:path*` → `shukatsu-lp` の透過プロキシが追加されているため、数十秒後 `https://shukatsu.enosapo.com/lp/board/` で配信開始。

## 関連ドキュメント

- `~/.company/marketing/_common/lp/README.md` — LP 共通ルール（Figma → CSS 実装鉄則、既知の落とし穴）
- `~/.company/marketing/shukatsu/lp/saitan/STATUS.md` — 派生元 saitan LP の詳細
- `~/.company/development/shukatsu-board/` — プロダクト本体
