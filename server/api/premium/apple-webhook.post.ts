// Apple App Store Server Notifications V2 — 接收骨架
// 后续实现签名验证 + JWS 解析
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // TODO: 1. 验证 Apple 签名 (x5c chain → root cert)
  // TODO: 2. 解析 signedPayload (JWS → JSON)
  // TODO: 3. 根据 notificationType 分发处理
  // TODO: 4. 更新 premium_orders + users 表

  console.log('[Apple Webhook] Received:', JSON.stringify(body).slice(0, 200))

  // Apple 要求返回 200 表示收到
  return { success: true }
})
