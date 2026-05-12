# shukatsu-lp

EnoVance 新卒事業部 (shukatsu) の LP 群を集約した Vercel プロジェクト。

## 構成

```
shukatsu-lp/
├── _shared/             ← 全 LP 共通モジュール（素の JS、バンドラなし）
│   └── intake-payload.js   ← クエリパラメータ汎用転送ロジック
├── saitan/              ← 最短内定 LP (2026-05 公開予定)
│   ├── index.html
│   ├── thanks.html
│   └── assets/
├── api/
│   └── submit.ts        ← LP → CRM API への中継 (Vercel Edge Function)
├── vercel.json          ← rewrites / cache headers
├── package.json
├── tsconfig.json
└── README.md
```

将来 LP を追加する時は `<lp名>/` フォルダを直下に作って git push するだけ。
URL は自動的に `https://shukatsu.enosapo.com/<lp名>/` で配信される。

## 共通モジュール（_shared/）

全 LP で共用するロジックを `_shared/` ディレクトリに配置している。バンドラなしの前提で、素の JS（ブラウザグローバル）として書く。

### intake-payload.js — クエリパラメータ汎用転送

LP のフォーム送信時に `window.location.search` のクエリパラメータを CRM `/api/lp/intake` に転送する。UTM / 媒体マクロ / ASP 識別子に**汎用対応**（新媒体が増えても LP 側コード変更不要）。CRM 側 (`extractAspParams`, Phase 27-C) が予約語以外を `crm_inflows.utm_params.asp_params` に自動保存する設計と一貫している。

#### 使い方

```html
<script src="../_shared/intake-payload.js"></script>
<script>
  const queryParams = (window.IntakePayload && window.IntakePayload.collectQueryParams)
    ? window.IntakePayload.collectQueryParams()
    : {};
  const payload = {
    ...queryParams,            // 先頭で展開 → LP 固有フィールドが必ず優先（?source=xxx 等の改ざん対策）
    source: 'YOUR_LP_CODE',
    name, phone, email, prefecture, applicationId,
  };
  await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
</script>
```

#### 仕様

- LP 内部制御パラメータ（`debug`, `preview`, `lp_preview`, `no_cache`, `cache_bust`）は除外（ブラックリスト方式）
- キー名は英数字 + `_` `-` `.` のみ、値は最大 500 文字、合計最大 30 パラメータまで
- それ以外は全て転送（CRM 側で予約語以外を `asp_params` に自動保存）
- `<script src>` のロードに失敗しても送信は止めない（呼び出し側で `window.IntakePayload` の存在チェックを挟む）

#### 新規 LP 作成時

新規 LP（`career-a` 等）を `lp/career-a/index.html` として作る時は、上記の `<script src="../_shared/intake-payload.js">` タグ 1 行 + `collectQueryParams()` 呼び出し 1 行を足すだけで同等の汎用転送機能が使える。新媒体への対応は CRM 側のマスタ追加（`crm_physical_lps` / `crm_lps`）のみで完結し、LP 側の改修は不要。

## ホスティング

- **GitHub repo**: `enosapo/shukatsu-lp`
- **Vercel project**: `shukatsu-lp`
- **Custom Domain**: `shukatsu.enosapo.com`
- **DNS**: Cloudflare (CNAME → cname.vercel-dns.com)

## 環境変数 (Vercel)

| 変数 | 内容 |
|---|---|
| `LP_INTAKE_SECRET` | CRM `/api/lp/intake` と一致させる共有シークレット |

## デプロイフロー

```
[ローカル編集]
   ↓
[git push]
   ↓
[Vercel 自動デプロイ]
   ↓
[shukatsu.enosapo.com/<lp名>/ で配信]
```

## 旧 LP の扱い

`standard-a` `standard-b` `standard-c` は Xserver で残置運用中（新規流入は流さない方針）。
.gitignore で除外しているため、この repo / Vercel デプロイには含まれない。

## 関連

- CRM: https://github.com/enosapo/enovance-crm
  - 受信 endpoint: `src/app/api/lp/intake/route.ts`
- LP テンプレ: `~/.company/marketing/_common/lp/`
- 設計記録: `~/.company/secretary/notes/2026-05-11-decisions.md`
