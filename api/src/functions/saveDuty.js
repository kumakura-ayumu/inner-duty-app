// @ts-check
'use strict'

const { app } = require('@azure/functions')
const { CosmosClient } = require('@azure/cosmos')

/**
 * SWA の x-ms-client-principal ヘッダーをデコードする。
 * ヘッダーは以下構造の JSON を base64 エンコードしたもの:
 * {
 *   "identityProvider": "aad",
 *   "userId": "abc123",
 *   "userDetails": "user@example.com",
 *   "userRoles": ["authenticated"],
 *   "claims": [
 *     { "typ": "http://schemas.microsoft.com/identity/claims/tenantid", "val": "xxx" },
 *     ...
 *   ]
 * }
 * @param {string} headerValue
 * @returns {{ identityProvider: string, userId: string, userDetails: string, userRoles: string[], claims: Array<{ typ: string, val: string }> } | null}
 */
function decodeClientPrincipal(headerValue) {
  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

app.http('saveDuty', {
  methods: ['POST'],
  // SWA がエッジで認証を担保するため authLevel は anonymous。
  // 関数自身も principal ヘッダーを検証することで多層防御を実現する。
  authLevel: 'anonymous',
  handler: async (request, context) => {
    context.log('saveDuty: 呼び出し開始')
    try {

    // ── セキュリティチェック 1: principal ヘッダーの存在確認 ──
    const principalHeader = request.headers.get('x-ms-client-principal')
    if (!principalHeader) {
      context.warn('saveDuty: x-ms-client-principal ヘッダーが見つかりません')
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized: No client principal found' },
      }
    }

    // ── セキュリティチェック 2: base64デコード & JSON解析 ──
    const principal = decodeClientPrincipal(principalHeader)
    if (!principal) {
      context.warn('saveDuty: principal のデコードに失敗しました')
      return {
        status: 401,
        jsonBody: { error: 'Unauthorized: Failed to decode client principal' },
      }
    }

    // ── セキュリティチェック 3: AAD 認証であることを確認 ──
    // SWA Easy Auth は claims を渡さないため identityProvider で確認する。
    // SWA 自体が AAD 認証を強制しているため多層防御として機能する。
    if (principal.identityProvider !== 'aad') {
      context.warn(
        `saveDuty: 許可されていない identityProvider: ${principal.identityProvider}`,
      )
      return {
        status: 403,
        jsonBody: { error: 'Forbidden: AAD authentication required' },
      }
    }

    // ── セキュリティチェック 4: 許可ドメインの確認 ──
    // ゲストアカウント・個人MSA等の社外アカウントを排除する。
    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN
    if (allowedDomain) {
      const userEmail = (principal.userDetails || '').toLowerCase()
      if (!userEmail.endsWith(`@${allowedDomain.toLowerCase()}`)) {
        context.warn(`saveDuty: 許可されていないドメイン: ${userEmail}`)
        return {
          status: 403,
          jsonBody: { error: 'Forbidden: Account not allowed' },
        }
      }
    }

    // ── リクエストボディの解析 ──
    /** @type {{ duties?: Array<{ id: string, day: string, member: string }> }} */
    let body
    try {
      body = await request.json()
    } catch {
      return {
        status: 400,
        jsonBody: { error: 'Bad Request: Invalid JSON body' },
      }
    }

    const { duties } = body
    if (!Array.isArray(duties) || duties.length === 0) {
      return {
        status: 400,
        jsonBody: { error: 'Bad Request: duties must be a non-empty array' },
      }
    }

    for (const duty of duties) {
      if (
        typeof duty.id !== 'string' ||
        typeof duty.day !== 'string' ||
        typeof duty.member !== 'string'
      ) {
        return {
          status: 400,
          jsonBody: {
            error: 'Bad Request: each duty must have id, day, member as strings',
          },
        }
      }
    }

    // ── Azure Cosmos DB へ保存 ──
    const connectionString = process.env.AZURE_COSMOS_CONNECTION_STRING
    if (!connectionString) {
      context.error('saveDuty: AZURE_COSMOS_CONNECTION_STRING 環境変数が未設定です')
      return {
        status: 500,
        jsonBody: { error: 'Server configuration error: AZURE_COSMOS_CONNECTION_STRING not set' },
      }
    }

    const savedAt = new Date().toISOString()
    const savedBy = principal.userDetails || principal.userId || 'unknown'
    const id = String(Date.now())

    const client = new CosmosClient(connectionString)
    const container = client.database('inner-duty-db').container('DutySchedule')

    await container.items.create({
      id,
      partitionKey: 'schedule',
      dutiesJson: JSON.stringify(duties),
      savedBy,
      savedAt,
    })

    context.log(`saveDuty: Cosmos DB に保存しました。id=${id}, savedBy=${savedBy}`)
    return {
      status: 200,
      jsonBody: { success: true, savedAt },
    }

    } catch (outerErr) {
      // 想定外の例外を握りつぶさず 500 で返す（空レスポンスを防ぐ）
      context.error('saveDuty: 予期しないエラー:', outerErr)
      return {
        status: 500,
        jsonBody: { error: 'Internal server error' },
      }
    }
  },
})
