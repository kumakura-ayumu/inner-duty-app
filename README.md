# 給湯室当番アプリ

Azure Static Web Apps + Azure Functions + Azure Cosmos DB で構築した社内向け当番管理アプリ。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 18 + TypeScript + Vite |
| スタイル | Tailwind CSS |
| バックエンド | Azure Functions v4 (Node.js 20) |
| データベース | Azure Cosmos DB for NoSQL |
| 認証 | Azure AD (SWA Easy Auth) |
| ホスティング | Azure Static Web Apps |

## ローカル開発環境のセットアップ

### 前提条件（グローバルインストール）

```bash
# Azure Functions Core Tools（func コマンド）
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

> **Node.js バージョンに注意：** Azure Functions Core Tools v4 は Node.js **v20** が必要です。
> v24 など新しすぎるバージョンは非対応です。
> バージョン管理には [fnm](https://github.com/Schniz/fnm) を推奨します。
>
> ```bash
> winget install Schniz.fnm   # fnm インストール（要ターミナル再起動）
> fnm install 20
> fnm use 20
> node --version              # v20.x.x と表示されればOK
> ```

### 初回セットアップ

```bash
# 1. フロントエンドの依存関係
npm install

# 2. バックエンドの依存関係
npm install --prefix api

# 3. 環境変数ファイルの作成
cp api/local.settings.json.example api/local.settings.json
# api/local.settings.json を編集して接続文字列を設定する
```

### 環境変数

`api/local.settings.json` に以下を設定：

| 変数名 | 説明 |
|---|---|
| `AzureWebJobsStorage` | Azure Functions ランタイム用ストレージ（開発時は `UseDevelopmentStorage=true`） |
| `AZURE_COSMOS_CONNECTION_STRING` | Cosmos DB の接続文字列（Azure Portal > inner-duty-cosmos > キー > PRIMARY CONNECTION STRING） |
| `ALLOWED_EMAIL_DOMAIN` | 許可するメールドメイン（例: `certify.jp`） |

フロントエンド用に `.env` ファイルも作成：

```bash
cp .env.example .env
# VITE_ALLOWED_EMAIL_DOMAIN=certify.jp
```

### 起動方法

**ターミナル1：Azurite（ローカルストレージエミュレーター）**

```bash
npx azurite --silent
```

**ターミナル2：アプリ本体**

```bash
npm run swa
```

ブラウザで `http://localhost:4280` にアクセス。

## Azure リソース構成

| リソース | 名前 | 備考 |
|---|---|---|
| Cosmos DB アカウント | inner-duty-cosmos | Japan East / Free Tier |
| Database | inner-duty-db | 複数アプリで共有想定 |
| Container | DutySchedule | Partition key: `/partitionKey` |
| Static Web App | （デプロイ時に作成） | Japan East |

## Cosmos DB データ構造

```json
{
  "id": "<timestamp_ms>",
  "partitionKey": "schedule",
  "dutiesJson": "[{\"id\":\"1\",\"day\":\"月曜日\",\"member\":\"田中\"}]",
  "savedBy": "user@certify.jp",
  "savedAt": "2026-02-24T00:00:00.000Z"
}
```

## セキュリティ

- Azure AD 認証必須（SWA Easy Auth）
- 許可ドメイン検証（バックエンドでも多層防御）
- AAD 以外の ID プロバイダーはブロック

## トラブルシューティング

### `swa` コマンドが見つからない

```
'swa' is not recognized as an internal or external command
```

ルートの `node_modules` が未インストール。プロジェクトルートで実行：

```bash
npm install
```

---

### `func` コマンドが見つからない

グローバルインストール後も認識されない場合は**ターミナルを再起動**してください。
インストール前に開いていたターミナルは古い PATH を持ち続けるため、新しいターミナルを開く必要があります。

確認：

```bash
func --version   # 4.x.x と表示されればOK
```

---

### `Could not connect to http://localhost:7071`

Azure Functions が起動していない。`npm run swa` が `--api-location api` オプションを持っているか確認：

```json
"swa": "swa start http://localhost:5173 --run \"npm run dev\" --api-location api"
```

---

### `Port 5173 is already in use`

前回の `npm run swa` プロセスが残っている。ターミナルリストの `node` / `esbuild` プロセスを終了してから再実行してください。

---

### `incompatible with your current Node.js vXX`

Node.js のバージョンが新しすぎる（v21 以降は非対応）。Node.js v20 に切り替えてください（前提条件の fnm 手順を参照）。

`fnm install 20` 後も認識されない場合は**ターミナルを再起動**してください（winget によるインストールは再起動後に PATH が反映されます）。

`fnm install 20` で `アクセスが拒否されました（os error 5）` が出る場合は、社内PCのポリシーにより fnm からのダウンロードがブロックされています。
代わりに **Node.js 20 LTS のインストーラーを直接ダウンロード**してください：
[https://nodejs.org/ja/download/](https://nodejs.org/ja/download/) → **v20 LTS** の **Windows Installer (.msi)** を選択して実行。

---

### Azurite を起動しないと Functions が動かない

`AzureWebJobsStorage` が `UseDevelopmentStorage=true` のため、Azurite が起動していないと Functions が起動しません。
**必ずターミナル1で Azurite を先に起動**してから `npm run swa` を実行してください。
