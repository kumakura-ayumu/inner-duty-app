#!/bin/sh

# ① npm install（Runtime Install - ビルド時ではなく起動時に実行）
echo "Installing dependencies..."
npm install
npm install --prefix api

# ② 環境変数から api/local.settings.json を生成（func start が読み込む）
cat > /app/api/local.settings.json << EOF
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_COSMOS_CONNECTION_STRING": "${AZURE_COSMOS_CONNECTION_STRING}",
    "ALLOWED_EMAIL_DOMAIN": "${ALLOWED_EMAIL_DOMAIN}"
  }
}
EOF

# ③ Azurite（Azure Storage エミュレーター）をバックグラウンドで起動
azurite --silent --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0 &

# Azurite が port 10000 で起動するまで待機
echo "Waiting for Azurite to start on port 10000..."
while ! nc -z localhost 10000; do
  sleep 1
done
echo "Azurite is ready"

# ④ Azure Functions をバックグラウンドで起動
(cd /app/api && func start) &

# func が port 7071 で起動するまで待機
echo "Waiting for Azure Functions to start on port 7071..."
while ! nc -z localhost 7071; do
  sleep 2
done
echo "Azure Functions is ready"

# ⑤ SWA CLI を起動
exec npm run swa:docker
