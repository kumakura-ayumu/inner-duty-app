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

### 前提条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) がインストール済みであること

### 初回セットアップ

```bash
# 環境変数ファイルの作成
cp .env.example .env
# .env を編集して接続文字列を設定する
```

### 環境変数

`.env` に以下を設定：

| 変数名 | 説明 |
|---|---|
| `VITE_ALLOWED_EMAIL_DOMAIN` | 許可するメールドメイン（フロントエンド用） |
| `AZURE_COSMOS_CONNECTION_STRING` | Cosmos DB の接続文字列（Azure Portal > inner-duty-cosmos > キー > PRIMARY CONNECTION STRING） |
| `ALLOWED_EMAIL_DOMAIN` | 許可するメールドメイン（バックエンド用） |

### 起動方法

```bash
docker-compose up
```

ブラウザで `http://localhost:4280` にアクセス。

ローカルでは擬似認証画面（Azure Static Web Apps Auth）が表示されます。
**Username** に許可ドメインのメールアドレスを入力して **Login** を押してください。

```
test@certify.jp
```

## Azure リソース構成

| リソース | 名前 | 備考 |
|---|---|---|
| Cosmos DB アカウント | inner-duty-cosmos | Japan East / Free Tier |
| Database | inner-duty-db | 複数アプリで共有想定 |
| Container | DutySchedule | Partition key: `/partitionKey` |
| Static Web App | inner-duty-app | Japan East |

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

### コンテナが起動しない

`.env` ファイルが存在するか確認：

```bash
cp .env.example .env
# AZURE_COSMOS_CONNECTION_STRING に実際の接続文字列を設定
```

---

### `Port 4280 is already in use`

前回の `docker-compose up` が残っている：

```bash
docker-compose down
docker-compose up
```

---

### Azure Functions がエラーになる

`docker-compose up` のログを確認。よくある原因：

- `AZURE_COSMOS_CONNECTION_STRING` が未設定または誤り
- Cosmos DB の Database/Container が存在しない（`inner-duty-db` / `DutySchedule`）
