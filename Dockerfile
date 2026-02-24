FROM node:20-slim

# ネイティブモジュールのビルドツール + netcat
RUN apt-get update && apt-get install -y python3 make g++ netcat-openbsd libicu-dev && rm -rf /var/lib/apt/lists/*

# Azure Functions Core Tools（func コマンド）
RUN npm install -g azure-functions-core-tools@4 azurite --unsafe-perm true

WORKDIR /app

# 依存関係インストール（キャッシュ活用のため先にコピー）
COPY package*.json ./
RUN npm install

COPY api/package*.json ./api/
RUN npm install --prefix api

COPY . .

EXPOSE 4280 5173

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npm", "run", "swa:docker"]
