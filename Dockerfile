FROM mcr.microsoft.com/devcontainers/typescript-node:20

# devcontainers イメージは python3/make/g++ 同梱済み
# 追加で必要な OS ツールのみインストール
USER root
RUN apt-get update && apt-get install -y netcat-openbsd libicu-dev && rm -rf /var/lib/apt/lists/*

# Azure 開発ツール（グローバル）
RUN npm install -g azure-functions-core-tools@4 azurite --unsafe-perm true

WORKDIR /app
EXPOSE 4280 5173
