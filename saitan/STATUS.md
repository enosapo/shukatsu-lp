# saitan LP — Status & Handoff

**最終更新**: 2026-05-11 12:05
**ステータス**: ✅ **Vercel 本番反映完了** — `https://shukatsu.enosapo.com/saitan/` で稼働中
**次セッションでの読み方**: このファイルだけ読めば現状把握できるよう自己完結的に記述。

> ⚠️ **2026-05-11 大幅刷新**: Xserver/PHP 方式から **Vercel + Edge Function** に完全移行。本ファイル下部の「Xserver 時代の本番デプロイ手順」は historical reference として残置。現在の運用は `~/.company/marketing/shukatsu/lp/README.md` 参照。
>
> - GitHub: `enosapo/shukatsu-lp`
> - Vercel project: `shukatsu-lp` (Custom Domain: `shukatsu.enosapo.com`, DNS: Cloudflare CNAME → vercel-dns-016)
> - Edge Function: `marketing/shukatsu/lp/api/submit.ts` (旧 `submit.php` の TS 移植)
> - 詳細経緯: `~/.company/secretary/notes/2026-05-11-decisions.md`

---

## 🎯 ゴール

`https://enosapo.com/shukatsu/saitan/` の就活生向け LP を、

1. **送信先を CRM の `/api/lp/intake` に直送**（GAS + スプレッドシート方式を廃止）
2. **デザインを Figma 由来でゼロイチ再構築**（standard-a 由来の hero / progress / 6 step ウィザードは引き継がない）

の両軸で立ち上げる。本番デプロイは未実施。

---

## 🧱 現在のフォルダ状態（2026-05-09 18:30 時点）

```
marketing/shukatsu/lp/saitan/
├── STATUS.md         ← このファイル
├── index.html        ← 4 ステップウィザード（実装済、PC レイアウト Figma 一致）
├── thanks.html       ← 完了ページ（実装済、PC レイアウト調整必要）
├── submit.php        ← 自ドメイン中継。新アーキ準拠（保持）
├── .htaccess         ← HTML/PHP キャッシュ無効化（保持）
└── assets/           ← Figma 由来画像（hero/laurel/ribbon/bubble/dot）
    ├── hero-bg.jpg          (3MB、人物ヒーロー写真、要圧縮)
    ├── laurel-01.svg        (月桂樹枠1、テキストは HTML オーバーレイ)
    ├── laurel-02.svg
    ├── laurel-03.svg
    ├── ribbon.svg           (黒リボン形状、CSS clip-path で代替使用中)
    ├── bubble.svg           (吹き出し形状、未使用 CSS で代替)
    ├── dot-left.svg
    └── dot-right.svg
```

**重要な注意**: ダウンロードした画像は元 `.png` 拡張子だったが中身は SVG/JPEG。リネーム済（→ `.svg` / `.jpg`）。

---

## ✅ 実装済 / 取り扱い済

### CRM 側（`~/.company/development/crm/`）

| ファイル | 内容 |
|---|---|
| `supabase/migrations/20260639_crm_channel_lp_saitan.sql` | `crm_channels` に `code='lp_saitan'` / `name='LP-saitan'` / `channel_type='owned'` / `scope=['shinsotsu']` を追加。**ローカル適用済**、本番未適用。 |
| `src/app/api/lp/intake/route.ts` | POST + OPTIONS。`X-LP-Secret` ヘッダー検証 + CORS（`enosapo.com` / `localhost:3000`）+ zod バリデーション + service_role で `crm_candidates` + `crm_inflows` 二段 INSERT + Slack 通知（`notifyLpSlack`）。**2026-05-07 に汎用化済**: payload.source から `lp_<source>` チャネルを動的解決するため、saitan 以外の LP も新規 channel migration を足すだけで動く。**push 済 (commit `0ba46ac`)**。本番未デプロイ。 |
| `.env.local.example` | `LP_INTAKE_SECRET` / `SLACK_LP_WEBHOOK_URL` を追記。 |

**route.ts の特徴**:
- zod スキーマで `source`(必須/`/^[a-z0-9][a-z0-9_-]{0,49}$/i`) `name`(必須/最大100) `phone`(必須/全角→半角正規化/8-20桁) `email`(任意/RFC) `prefecture`(任意/最大20) を検証
- スキーマは `.passthrough()` で **未知のフィールドは extra に丸ごと格納**
- channel code は `lp_${data.source}` で動的解決 → 新規 LP は migration を 1 本足すだけ
- `candidate_type='shinsotsu'` / `status='lead'` / `assigned_ca_id=NULL`（未担当）固定
- `extra.lp_source = data.source` / `extra.lp_origin = <Origin ヘッダ>` を自動付与
- `landing_page = data.source` で `crm_inflows` に記録
- 候補者作成成功 + 流入記録失敗時は HTTP 207 で候補者を救う設計
- Slack 通知は `SLACK_LP_WEBHOOK_URL` 未設定時はスキップ、失敗しても候補者作成は巻き戻さない fail-soft 設計
- 認証なし公開エンドポイント（service_role 使用、RLS bypass）+ `X-LP-Secret` 共有シークレット

### LP 側（このディレクトリ）

| ファイル | 内容 | 状態 |
|---|---|---|
| `index.html` | 4 ステップウィザード (feeling/status/prefecture/name+phone+email)。Figma MCP で取得したデザインからゼロイチ実装。Noto Sans JP / Hiragino。`@media (min-width: 768px)` で PC レイアウトに切替。submit.php に POST → CRM API。**フォーム interior は `.board__contents > form { max-width: 360px; margin: 0 auto }` で常に 360px 中央配置**（Figma の Container x=300 / w=360 in Board 960 を反映）。Hero bg は `118.75% 243.49% / left bottom` 固定で頭切れ防止。サブタイトル改行は `.br-pc` / `.br-sp` で PC=2 行 / SP=3 行を切替。 | ✅ Figma pixel-near 一致 |
| `thanks.html` | 完了ページ。URL パラメータから name/oid 表示。`event: cv_complete` を GTM dataLayer に push。「トップページへ戻る」ボタンは `https://enovance.co.jp/` リンク。**index.html と同じ Hero / Board Title CSS を共有**し、`board__contents` 内側を `.thanks-container { max-width: 360px; margin: 0 auto; gap: 24px }` で Figma `pc_thanks` の Container (300/40/360) と一致させる。Title 18px / Body 16px×3段落 mb16 / Button 100% w 48h #ddd。 | ✅ Figma `pc_thanks` pixel-near 一致 |
| `assets/` | Figma 由来 8 ファイル（hero/laurel×3/ribbon/bubble/dot×2）。月桂樹は SVG パスのみで「平均21日で内定」等のテキストは HTML 側でオーバーレイ実装。 | ✅ |
| `submit.php` | LP からの POST を受けて CRM API に転送する自ドメイン中継。`X-LP-Secret` ヘッダーをここで付与（HTML 露出を回避）+ **Origin/Referer 自ドメイン照合**（2026-05-07 追加、secret 漏洩時の二段目防御）。`$UPSTREAM_URL` は本番値 `https://enovance-crm.vercel.app/api/lp/intake`（2026-05-11 訂正、`enovance.jp` ドメインは未取得のため Vercel デフォルトに統一）。`$LP_INTAKE_SECRET` のみデプロイ前に差し替えが必要。 | ✅ 保持 |
| `.htaccess` | HTML / PHP のキャッシュ無効化。モバイル WebView で古い版が掴まれる事故防止。Apache 前提。 | ✅ 保持 |

---

## 🚧 未解決事項（次セッションで継続）

### ⚠️ オーナー実機で SP footer が見えない報告（最優先・原因切り分け中）

**症状**: PC Chrome DevTools mobile emu モード (390 viewport) で SP 表示すると、footer の「会社名・プライバシーポリシー・コピーライト」がスクロール末端でも見えないとオーナーから複数回報告。

**現状の対策（適用済 2026-05-11 朝）**:
- `.lp { min-height: 100vh; min-height: 100dvh }` 2 段書き（dvh 対応 browser で URL バー対応）
- `.footer { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)) }` (iOS home indicator 対応)
- `.board__contents` padding 整理、`.board__title` 25/16 への縮小でページ全体 25px 短縮

**しかし Playwright fullPage screenshot では footer 完全描画されている**:
- `/tmp/saitan-shots/sp-footer-fix.png` (390×800 viewport)
- `/tmp/saitan-shots/sp-recheck.png` (改修後再確認)

**最有力原因**: ブラウザキャッシュで古い CSS を掴んでいる。

**次セッションでやるべき切り分け**:
1. オーナーに **`Cmd+Shift+R` / DevTools "Disable cache" を ON** で再確認依頼
2. オーナーに **DevTools Console エラー** スクショ依頼
3. オーナーに **別ブラウザ (Firefox / Safari)** での再現確認依頼
4. オーナーに **実機 iPhone Safari** での確認（DevTools mobile emu と挙動違うため）依頼
5. それでも再現するなら、`.lp { min-height: 100vh }` を **完全削除**して content-driven height にしてみる（min-height が悪さしている可能性）
6. または `body { height: auto !important }` 等でブラウザ強制スクロール許容を試す

### 数字を Figma 準拠の赤色にする（任意 / 優先度低）

現状、月桂冠の中の数字（21日 / 3,200名 / 91%）は **SVG にパスとして焼き込まれており**、葉と一緒に bronze グラデーション（`#5C3D1A → #C9A24F → #5C3D1A`）で描画される。Figma では数字が赤（`#d22d26`）。

**選択肢**:
1. このまま運用（葉と数字の一体感はあるが Figma と完全一致ではない）
2. Figma から葉のみの SVG を再エクスポート → HTML テキストオーバーレイ（`.laurel__text`）を復活させ赤色で描画
3. 既存 SVG のパスデータを編集して葉と数字を別パスに分離（手作業困難）

→ オーナー判断待ち。当面は **選択肢1** で運用。

### 検証手順（次セッション開始時）

```bash
# 1. ローカルサーバ起動
cd ~/.company/marketing/shukatsu/lp/saitan
python3 -m http.server 8765

# 2. ブラウザで開く
# http://localhost:8765/index.html
# http://localhost:8765/thanks.html

# 3. Chrome headless でスクショして自己検証（推奨）
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-sandbox \
  --window-size=1280,1400 --virtual-time-budget=3000 \
  --screenshot=/tmp/saitan-pc1280.png http://localhost:8765/index.html

# 4. デザイン JPG と比較
# /Users/chikaarashitoshiya/Downloads/0504_enosapo_lp/jpg/pc/pc_step1.jpg ← 正解
```

### 進捗ステータス

- ✅ **HTML 構造**: 4 ステップウィザード + thanks 実装済
- ✅ **送信ロジック**: submit.php 経由 CRM API、LP_SOURCE='saitan' / APPLICATION_ID_PREFIX='SJ' 維持
- ✅ **assets**: Figma から取得・正しい拡張子にリネーム済。月桂冠 SVG は bronze gradient 化（2026-05-09）
- ✅ **SP レイアウト**: Figma `sp_step1` (1:2, 390×500) に合わせて全面 absolute positioning に書き換え（2026-05-10 昼）。Header padding `0 62px 0 24px` / logo 26px / tagline 12px。Hero 500px 固定、bg `175.73% 105.98% / 68.17% 98.33%`（CSS bg-position % は (container-image) 式で計算）、Heading 50px / Subtitle 16px bold 3 行 / Ribbon left 0 + right 5.9% (full-bleed) / Laurels 107×63 absolute top 48%。Board Title h2 24px / p 16px、Bubble 202×40 + 26px 上抜け / 完全無料 14px w72h26 / 30秒で完了 16px。`/tmp/saitan-shots/diff-sp.png` で Figma target と pixel-near 一致確認済。index.html / thanks.html 共に同期済。
- ✅ **PC レイアウト (index.html)**: Figma MCP から取得した実値で全要素一致（2026-05-09 夜、3 件のスケール修正完了）。Hero 543px / bg `118.75% 243.49%; left bottom`（auto から修正、頭切れ解消）/ Heading 82px / Subtitle 20px PC 2 行 / Ribbon 548×56 / Board 960 wide / **フォーム interior 360px 中央** (Container x=300 in Board 960 を反映) / Bubble 232×60 / Header 64px / 1440px センター。
- ✅ **PC レイアウト (thanks.html)**: Figma `pc_thanks` (66:3617) に合わせて全面書き換え完了（2026-05-10 朝）。Hero / Board Title は index.html と同一 CSS、`board__contents` 内側に `.thanks-container { max-width: 360px; margin: 0 auto; gap: 24px }` で Title 18px / Body 16px×3段落 mb16 / Button w-full 48h #ddd を配置。`/tmp/saitan-shots/diff-thanks.png` で Figma target と pixel-near 一致確認済。
- ✅ **PC ワイドモニター対応** (2026-05-11 朝): `.lp { max-width: 1440px; margin: 0 auto; box-shadow }` + body グレー背景で 1920+ モニターで LP 中央寄せ雑誌レイアウト風。1440 viewport では従来通り Figma 一致。
- ⚠️ **SP footer 「見えない」報告（オーナー継続中）**: Playwright fullPage では完全描画されている (`/tmp/saitan-shots/sp-footer-fix.png` / `sp-recheck.png` 全部 OK) が、オーナー実機 (PC Chrome DevTools mobile emu) で footer が画面下に隠れる報告継続。対策済み: `.lp { min-height: 100vh; min-height: 100dvh }` + `.footer { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)) }`。最有力原因はブラウザキャッシュ → 次セッションでオーナーに `Cmd+Shift+R` / DevTools "Disable cache" 確認依頼 + 別端末/別ブラウザでの再現テスト推奨。
- ⬜ **E2E テスト**: 未実施（CRM API への curl, ブラウザ実機確認）
- ⬜ **本番デプロイ**: CRM 本番デプロイ待機中

---

## 🚀 本来のゼロイチ再構築フロー（参考）

### Step 1. Figma MCP を user scope で接続（公式 Remote MCP / OAuth）

```bash
claude mcp add --scope user --transport http figma https://mcp.figma.com/mcp
```

→ ✅ 完了済（s.chikaarashi@enovance.co.jp で OAuth 認証済）

### Step 2-3. デザイン取得 → HTML/CSS 実装

→ ✅ 完了済（Figma URL: `https://www.figma.com/design/daoRjLkva1H3wH22B82w4B/enosapo_lp?node-id=0-1`）

### Step 4. ローカル動作確認 → CRM 本番デプロイと同期で xserver にアップ

詳細は下記「本番デプロイ手順」セクション。

---

## 🚀 本番デプロイ手順（CRM 本番デプロイと同期、順番厳守）

> ⚠️ オーナー指示: **CRM 本番デプロイは別作業中につき待機**。

### 1. シークレット生成
```bash
openssl rand -hex 32   # 64 文字の 16 進文字列
```

### 2. Slack Webhook 発行
Slack ワークスペース → アプリ → Incoming Webhooks で URL 発行。投稿先チャンネルは「LP 新規 CV 通知」用。

### 3. CRM 本番デプロイ + 環境変数登録
- Vercel にデプロイ
- Vercel 環境変数:
  - `LP_INTAKE_SECRET=<手順1 で生成した文字列>`
  - `SLACK_LP_WEBHOOK_URL=<手順2 で発行した Webhook URL>`
- 既存の Supabase / GOOGLE_OAUTH_CRM_* も忘れず登録（CRM 側 STATUS.md 参照）

### 4. 本番 Supabase に migration 適用
```bash
supabase db push   # 20260639 を含む
```

### 5. `submit.php` の 1 箇所を本番値に差し替え
```php
$LP_INTAKE_SECRET = '<手順1 で生成した文字列>';   // ← Vercel と同じ値
```
（`$UPSTREAM_URL` は既に本番値 `https://enovance-crm.vercel.app/api/lp/intake`、2026-05-11 訂正）

### 6. xserver に LP ファイルをアップロード
xserver の管理パネル or FTP で 4 ファイルを上書きアップロード:
- `index.html`（再構築後の新版）
- `thanks.html`（再構築後の新版）
- `submit.php`
- `.htaccess`（隠しファイル表示オン）

### 7. 動作確認
- ブラウザで `https://enosapo.com/shukatsu/saitan/submit.php` に GET → `{"result":"error","message":"no payload"}` で PHP 稼働確認
- LP からテスト送信 → CRM `/crm/candidates`（候補者一覧）に表示されることを確認
- `crm_inflows` に `channel='LP-saitan'` のレコードが入ることを確認
- **Slack に通知が届くことを確認**（`:bell: 新規CV通知 (LP)` で始まるメッセージ）
- Origin/Referer 防御の確認: `curl -X POST https://enosapo.com/shukatsu/saitan/submit.php -H 'Origin: https://evil.example.com' ...` → 403
- 失敗時はブラウザ DevTools の Network タブで `submit.php` のレスポンスを見る:
  - 200 + `{"ok": true, ...}` → CRM API 経由で全成功
  - 200 + `{"ok": true, "warning": "inflow_insert_failed"}` → 候補者は救えた
  - 403 + `forbidden origin` → submit.php の Origin/Referer チェックで弾かれた
  - 502 + `upstream error: ...` → CRM API への curl が失敗
  - 401 (curl 経由) → secret 不一致
  - 400 → バリデーション失敗 / 500 → channel 未登録 or DB エラー
- **必ず実機の以下 5 環境すべてでテスト**（毎回ユニークな未踏 URL で）:
  - PC Safari/Chrome / モバイル Safari/Chrome
  - **モバイル LINE 内ブラウザ**（最重要、最も落ちやすい）
  - PC LINE 内ブラウザ
  - X / Instagram 内ブラウザ

### ローカル動作確認方法（デプロイ前にテストしたい場合）
```bash
# 1. CRM 起動
cd ~/.company/development/crm
echo "LP_INTAKE_SECRET=test123" >> .env.local
pnpm dev

# 2. 別ターミナルから curl
curl -X POST http://localhost:3000/api/lp/intake \
  -H "Content-Type: application/json" \
  -H "X-LP-Secret: test123" \
  -d '{"source":"saitan","name":"テスト太郎","phone":"09012345678","prefecture":"東京都","feeling":"今すぐ始めたい","applicationId":"SJ-20260507-120000"}'

# 期待: { "ok": true, "candidate_id": "...", "application_id": "SJ-20260507-120000" }
```
※ ローカル DB に migration 20260639 は適用済。

---

## 🔐 セキュリティ方針（決定事項）

**多層防御**（オーナー承認済 2026-04-28、2026-05-07 に層追加）:

1. **CRM API の `X-LP-Secret` 共有シークレット**（一次認証）
2. **submit.php の Origin / Referer 自ドメイン照合**（2026-05-07 追加、secret 漏洩時の二段目）
3. CRM API CORS（`enosapo.com` / `localhost:3000` のみ）
4. zod バリデーション（不正値ブロック）

注意点:
- LP の HTML には secret を書かない（PHP に隔離する設計）
- 流入実績が積み上がって攻撃が観測されたら **reCAPTCHA v3** に切り替える方針
- 監視ポイント: `/api/lp/intake` への異常リクエスト数 / 短時間に同 IP からの連投

---

## 📝 設計上の決定事項（why も含む）

| 決定 | Why |
|---|---|
| `index.html` / `thanks.html` をゼロイチ再構築（旧版削除） | standard-a 由来の DOM/CSS が新デザインに紛れ込むのを構造的に防ぐ。Figma を design source とする方針確定（2026-05-07）。 |
| 配置先は saitan を上書き（新フォルダを切らない） | 未デプロイで saitan の URL に配信実績がないため、フォルダ・channel・URL を温存する方が migration / 広告リンクの管理コストが低い。 |
| CRM API の channel 解決を `lp_${source}` 動的化 | テンプレート（`_common/lp/template/`）が「テンプレと言いながら saitan 専用」だった構造矛盾の解消。新規 LP ごとに migration を 1 本足すだけで動く。 |
| `concern` フィールドは LP 側自由 / API は extra にスルー | `.passthrough()` で受信形状の変化に強い。LP と CRM のリリースを切り離せる。 |
| `assigned_ca_id` は NULL（未担当） | CA への割当ロジックは未確定。CRM 側で手動割当 or 後続フェーズで自動化を検討。 |
| `crm_candidates.extra` jsonb に未知フィールドを丸ごと | 将来 LP の質問項目を追加・削除しても DB スキーマ変更不要。 |
| channel_type は `'owned'` | 流入元（広告/自然検索/SNS）は `utm_params` で別途記録される想定。 |
| HTTP 207 で候補者作成成功 + 流入記録失敗を表現 | 候補者を救う（取り逃さない）ことを優先。 |
| zod でバリデーション厳格化 | 公開エンドポイントのため不正値ブロック必須。`phone` は全角→半角自動変換でユーザー入力ゆれを吸収。 |
| Origin/Referer 防御は「明確に外部のみ拒否、空は通す」 | モバイル LINE / Instagram WebView は両ヘッダが空になるケースがあり、必須化すると正規流入を弾く。 |
| PC フォーム interior は `max-width: 360px` 中央固定（board__contents の左右 padding には依存させない） | Figma の Container は Board (960px) 内で **x=300, w=360 中央**。これを padding ベースで再現すると Board がリサイズした時の内部幅がブレる。form 自体に max-width を持たせれば、Board が縮んでも form は常に 360 中央で安定し、choice/submit ボタンも自動的に 360 になる。 |
| Hero bg は `background-size: 118.75% 243.49%` を **両軸明示**（auto を使わない） | Figma の指定は `width:118.75%, height:243.49%, top:-143.46%`。`auto` にすると画像の natural aspect 依存で実体高がズレ、`background-position: bottom` 時に頭部が画面外に押し出される（中央女性の頭頂部が切れる事故の原因）。両軸明示で aspect 強制 → bottom 揃えで Figma と完全一致。 |
| サブタイトル改行は PC 2 行 / SP 3 行で **HTML BR をクラス切替** (`.br-pc` / `.br-sp`) | Figma の改行位置は viewport ごとに違う（PC: 「独自の」後 / SP: 「面接対策や」「ご紹介で、」後）。`<br>` を CSS で `display: none/inline` 制御することで 1 つの HTML で両 viewport に最適な改行が出せる。 |

---

## 📂 関連ファイル早見表

```
~/.company/
├── marketing/shukatsu/lp/saitan/
│   ├── STATUS.md                                        ← このファイル
│   ├── submit.php                                       ← 自ドメイン中継（保持）
│   └── .htaccess                                        ← キャッシュ無効化（保持）
├── marketing/_common/lp/                                ← 新規 LP テンプレ + ドメインマップ
│   ├── README.md                                        ← 新規 LP 作成手順
│   ├── lp-domain-map.md                                 ← 既存 LP 一覧
│   └── template/                                        ← Step 2 でコピー元として使う
├── marketing/shukatsu/lp/standard-a/                    ← 旧 LP（GAS 連携、運用継続せず段階廃止）
└── development/crm/
    ├── src/app/api/lp/intake/route.ts                   ← API エンドポイント（汎用化済 / Slack 通知含む）
    ├── supabase/migrations/20260639_crm_channel_lp_saitan.sql
    ├── .env.local.example                               ← LP_INTAKE_SECRET / SLACK_LP_WEBHOOK_URL
    └── docs/STATUS.md                                   ← CRM 全体の状態
```

---

## 🆘 もし何かおかしくなったら

- LP 復旧（GAS 戻し）: `marketing/shukatsu/lp/standard-a/index.html` の送信処理セクションをコピペで戻せる（緊急時のみ）
- API 停止: `LP_INTAKE_SECRET` を Vercel から削除すれば全 POST が 500 で弾かれる
- migration ロールバック: `DELETE FROM crm_channels WHERE code = 'lp_saitan';` （流入レコードがある場合は事前に確認）

---

## 🔗 参考

- 原典 LP（旧版）: `marketing/shukatsu/lp/standard-a/index.html`（GAS 連携、GAS ID は `AKfycbxDFPMVDIN...`）
- 新規 LP テンプレ: `marketing/_common/lp/template/`
- LP ドメインマップ: `marketing/_common/lp/lp-domain-map.md`
- 2026-05-07 意思決定（汎用化 + 防御層 + ゼロイチ再構築方針）: `secretary/notes/2026-05-07-decisions.md`
- 2026-05-07 学び（モバイル LINE 経由未着事故）: `secretary/notes/2026-05-07-learnings.md`
- CRM データモデル: `~/.company/development/crm/docs/data-model.md`
- CRM 全体 STATUS: `~/.company/development/crm/docs/STATUS.md`
- 共通 CLAUDE.md: `~/.company/CLAUDE.md`（GitHub 連携・push 規律）

---

## 🗓 タイムライン

| 日付 | 出来事 |
|---|---|
| 2026-04-28 | standard-a から saitan へ index.html / thanks.html 複製。CRM 連携方針決定（共有シークレット採用、CA 未担当、channel='LP-saitan'）。 |
| 2026-04-29 | route.ts を zod 厳格化、migration をローカル適用、smoke test、commit `14bad6e` push 完了。Phase 11-H-1 として区切り。 |
| 2026-05-07 (1/3) | **アーキテクチャ刷新**: standard-a でのモバイル LINE 経由 CV 未着事故を踏まえ、`submit.php` 経由の自ドメイン中継 + `await fetch` 単一経路 + `.htaccess` キャッシュ制御を導入。シークレットを HTML から PHP に隔離。CRM API に Slack 通知 (`notifyLpSlack`) を追加。**スプシは廃止、CRM 直送 + Slack 通知のみ**の方針確定。 |
| 2026-05-07 (2/3) | **CRM API 汎用化 + 防御層追加**: `/api/lp/intake` を payload.source から `lp_<source>` 動的解決に変更（saitan ハードコード排除）。submit.php に Origin/Referer 自ドメイン照合を追加。テンプレ `submit.php` の `$UPSTREAM_URL` を本番値に。フォルダ再編（`_common/lp/template/`）に伴うドキュメント追従。commit `0ba46ac` push 完了。 |
| 2026-05-07 (3/3) | **ゼロイチ再構築開始**: standard-a 由来の `index.html` / `thanks.html` を削除。Figma MCP を design source としてゼロイチで再構築する方針確定。 |
| 2026-05-07 (4/4) | **Figma MCP 接続 + HTML/CSS 実装**: OAuth 認証完了、`fileKey=daoRjLkva1H3wH22B82w4B` から SP/PC 各 5 画面（step1-4 + thanks）の design context 取得。assets ダウンロード（拡張子修正含む）。`index.html` / `thanks.html` 実装。複数回 PC レイアウト調整するも視覚差分残存（写真 full-bleed・Board 左寄せが未達）。 |
| 2026-05-09 | **PC レイアウト Figma 準拠化完了**: (1) `.lp` の max-width 解除、`.mv` を全幅 + `.header`/`.mv__inner`/`.footer` を個別に max-width 1200px センター、(2) ヒーローを `background-size: 145% auto / position: 70% 100%` でズーム、人物を上に押し出してフォーム被りを回避、(3) フォームを `margin: clamp(-200px, -14vw, -140px) auto` で写真下部に重ね、(4) リボンを矢印テール clip-path に、(5) 月桂冠 SVG の linearGradient を bronze 3-stop に書き換え。**ハマった罠**: 月桂冠 SVG にラベル/数字テキストがパスとして焼き込まれており、HTML `.laurel__text` 重ねが二重表示になっていた → HTML 側を `display: none` に。 |
| 2026-05-09 (午後) | **PC レイアウト再調整**: オーナーから「写真が真ん中ではなく文字の横にあるべき」「アンケートの位置調整必要」の指摘。Figma `pc_step1.jpg` と Playwright スクショで差分確認。(1) ヒーロー高さを `clamp(720px, 64vw, 900px)` → `clamp(520px, 46vw, 660px)` に短縮、(2) `background-size: 145% auto / position: 70% 100%` → `auto 100% / right center` に変更（写真を高さフィット + 右寄せで人物が右側に集中）、(3) グラデーションを左完全白 → 右へのなだらかな fade に弱め、(4) フォームの負マージンを `clamp(-200px, -14vw, -140px)` → `clamp(-30px, -2vw, -16px)` に縮小しバブルブリッジ分のみに。これで Figma 同等の「左テキスト+右人物+下フォーム」3 ブロック構造が完成。SP は影響なし。検証スクショ: `/tmp/saitan-shots/diff-3way.png`。 |
| 2026-05-09 (夕) | **Figma MCP で全要素ピクセル一致化**: オーナー指示で Figma MCP から `pc_step1` (1440x1255) の全要素値を取得し、推測ではなく実値で CSS 全面更新。主要変更: (a) Hero height clamp(420,37.7vw,543) (Figma 543/1440 = 37.7vw)、(b) bg `118.75% auto / left bottom` (Figma React の `width:118.75%, top:-143.46%, left:0` を CSS化)、(c) Heading 82px / letter-spacing 0 / line-height 1.2、(d) Subtitle 20px / line-height 1.6 / 2 行表示、(e) Ribbon 548×56 / font 20px、(f) Board 960 wide / overlap -46px、(g) Bubble 232×60 / "30秒で完了" 18px / "完全無料" label 16px+height 30、(h) Header 64px tall / padding 140px / "就活生専門" のみ赤、(i) `.mv__inner` padding 75/140 (Figma の 13.81%/9.72% 由来)。検証: 1440/1280/1024/390 全 OK。`/tmp/saitan-shots/diff-1175.png` で Figma export (1176x1025) と side-by-side 一致確認。 |
| 2026-05-11 (朝-3) | **PC: LP を max-width 1440 でキャップ + body 中性グレー**: オーナー指摘「Figma の方が小さく見える」検証 → viewport 1440 で 1:1 比較すると Figma と完全一致だが、ユーザーは 1920+ ワイドモニターで見ており photo bg がフルブリードで広がり 82px heading が大きく感じていた。修正: PC media query で `.lp { max-width: 1440px; margin: 0 auto; box-shadow: 0 0 24px rgba(0,0,0,0.06) }` + `body { background: #f3f3f3 }` で 1440 を超えるモニターでは LP が中央寄せされ両脇にグレー余白が出る雑誌レイアウト風に。1440 viewport では従来通り Figma 一致、1920 ではコンパクト感増す。index.html / thanks.html 両方適用。 |
| 2026-05-11 (朝-2) | **PC バブル「完全無料」2 行 wrap fix**: 2026-05-10 SP 修正で `.board__bubble-free` に `width: 72px` を追加（Figma SP 値）したが、PC media query で reset していなかったため PC でも 72px 固定 → PC font 16px の「完全無料」（4 文字 ×16 ≈ 60px + padding 16）が 72px 内に収まらず wrap。PC 上書きに **`width: auto`** を追加して content-stretch（Figma PC 仕様）に戻した。index.html / thanks.html 両方適用。なお SP footer 「見えない」報告は Playwright fullPage screenshot で確認すると footer 完全描画されており、CSS 側問題はなし → **ブラウザキャッシュが疑わしい**。ユーザーには Cmd+Shift+R / DevTools "Disable cache" / `?v=$(date +%s)` でキャッシュバスト推奨。 |
| 2026-05-11 (朝) | **SP footer 隠れ問題 — iOS Safari 100vh + safe-area 対応**: オーナー実機で footer (会社名/プライバシーポリシー/copyright) が画面下に隠れる事象が継続。実測すると LP は 1175px tall で footer も正しく描画されているが、iOS Safari の URL バー（〜80px）/ home indicator（〜34px）が visible viewport を侵食し、スクロール末端でも footer 末尾が browser chrome 下に隠れていた。修正: (1) `.lp { min-height: 100vh; min-height: 100dvh; }` で dynamic viewport (Safari 15.4+/Chrome 108+) で動的に正しい高さ。古い browser は 100vh fallback。(2) `.footer { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)) }` で iPhone home indicator 領域分の余裕を確保。desktop browsers では env() が 0 で挙動変わらず、iOS では自動で 34px 余裕追加。index.html / thanks.html 両方適用。 |
| 2026-05-10 (昼-4) | **SP board__title 赤枠 25px 縮小**: オーナー指摘「赤枠が Figma より大きい」。実測すると私の赤枠 129px、Figma 130px だが Figma の **visible 赤** は **104px**（130 - 上部 26px は bubble 用透明領域、`inset-[20%_0_0_0]` で red gradient が 20% から始まる）。私の `.board__title` は全体が赤背景なので 129 全部赤＝Figma より +25px 大きい状態だった。padding 50/24/16 → **25/24/16** に修正し visible red 104px に揃える。bubble の top: -26 はそのままで、bubble 下端と h2 上端のギャップも Figma 一致。ページ総高さ 1199 → 1174（Figma 1164 比 +10）。index.html / thanks.html 両方適用。 |
| 2026-05-10 (昼-3) | **SP hero gradient 軽量化 + Footer Figma 値同期**: オーナー指摘「heading 上部に背景デザインがない」「footer 見えない」を反映。(1) `.mv__bg::after` グラデーションを top 0.85 → **0.55** に下げ（25%/45%/55% で fade-out）、写真テクスチャが heading 背後にうっすら見えるように。Figma React は MV にグラデーション無しだが、画像のみだと heading 文字可読性が下がるため弱グラデーションを残す。(2) Footer は Figma `28:7785` 取得 → padding 48 → **64**（Figma `py-64`）、gap 12 → **16**、nav 13px → **14px** (`SP/Body/S`)、copy 11px → **12px** (`SP/Caption/XS`)。logo 20px は元から一致。index.html / thanks.html 両方適用。 |
| 2026-05-10 (昼-2) | **SP ヘッダー tagline wrap fix**: Figma React の `whitespace-nowrap` がヘッダー全体に付いているのを見落としていた。`.header { white-space: nowrap }` + `.header__tagline { flex-shrink: 0 }` を追加して tagline「キャリアサポートサービス」が「キャリアサポートサービ」+「ス」と 3 行になる事故を解消。index.html / thanks.html 両方適用。「赤枠/文字が Figma より若干大きい」という付随指摘は、Figma JPG (1164px tall) と Playwright fullPage screenshot (`.lp { min-height: 100vh }` で 1300px tall) の縦長差で要素が相対的に小さく見えていたのが主因。実値は 1:1 で Figma metadata 通り。 |
| 2026-05-10 (昼) | **SP レイアウトを Figma `sp_step1` (1:2) に合わせて全面書き換え**: 旧 SP CSS は flex column + 220px photo-spacer ベースで、Hero が縦に潰れ写真も貧弱だった。Figma SP は 500px 固定 Hero + 全要素 absolute positioning（Heading top 5.4%, Subtitle 19.6%, Ribbon 36.8% full-bleed left, Laurels 48%）。Header padding `0 62px 0 24px` + logo 26px + tagline 12px。Board Title bubble 202×40 上抜け 26px。Bubble label 14px w72h26 + text 16px。SP/PC 衝突回避のため PC media query 内で `position: static; top/left/right: auto;` を `.mv__heading/.mv__sub/.mv__ribbon/.mv__laurels` に追加し flex flow 復元。**bg-position の罠**: Figma の `<img>` `left:-51.62% top:-5.88%` を CSS background-position にそのまま転写すると画像が画面外に消える（bg-position % は `image-left% × container_w` ではなく `% × (container_w - image_w)` の式）。再計算: `68.17% 98.33%`。index.html / thanks.html 両方適用、`/tmp/saitan-shots/diff-sp.png` で Figma target と pixel-near 一致確認、PC リグレッションなし。 |
| 2026-05-10 (朝) | **thanks.html を Figma `pc_thanks` (66:3617) に合わせて全面書き換え**: 旧版は `max-width: 1200px / clamp(28px, 3vw, 48px) 50%` などの古い PC スタイルで Hero がデスクトップで小さく潰れていた。`get_metadata` でフレーム構造取得 → step1 と Hero / Board Title が完全一致、Container 構造のみ違う（top padding 40px、gap 24px、Title 18px / Body 16px / Button 48h）と判明。index.html の Hero/Board CSS をそのまま流用し、`board__contents` 内側に `.thanks-container` (max-width 360 中央、gap 24) を追加して Title + Body 3 段落 + Button を配置。検証: 1440 / 390 共に Figma と一致（`/tmp/saitan-shots/diff-thanks.png`）。 |
| 2026-05-09 (夜) | **3 件のスケール修正**: オーナー指摘「フォームが横長」「中央女性の頭頂部が切れる」「コンテンツが画面全幅に広がる」を Figma MCP の `Board Contents` 構造取得で原因特定 → 修正。(1) **フォーム横長**: Figma の `Container x=300 width=360` (Board 960 内) を反映、`.board__contents > form` に `max-width: 360px; margin: 0 auto` を追加。`.board__contents` の左右 padding を `clamp(40,5vw,72)` → `40px` に縮小（実体は form の max-width 360 で決定）。choice-btn と submit-btn は自動的に form 幅に追従。(2) **頭切れ**: bg-size を `118.75% auto` → `118.75% 243.49%` に。auto は画像 natural aspect 依存で実体高が読めず、Figma の指定 (height 243.49%) と外れて頭部分が画面外にずれていた。(3) **PC サブタイトル 2 行化**: HTML BR を `.br-pc` / `.br-sp` クラスで条件化し、PC では「独自の」と「選考」の間で 1 回だけ改行（Figma 一致）、SP では従来の 3 行を維持。検証: 1440/1280/390 全 OK、`/tmp/saitan-shots/diff-fix.png` で Figma target と pixel-near 一致確認。 |
| (次回) | E2E テスト（curl で CRM API、実機ブラウザ） → 任意で月桂冠数字赤化 → CRM 本番デプロイ + xserver アップロード。 |
