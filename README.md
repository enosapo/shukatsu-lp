# shukatsu-lp

EnoVance 新卒事業部 (shukatsu) の LP 群を集約した Vercel プロジェクト。

## 構成

```
shukatsu-lp/
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
