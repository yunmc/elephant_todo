import { v4 as uuidv4 } from 'uuid'

export default defineEventHandler(async (event) => {
  // Rate limit: 20 reset emails per 15 minutes per IP (relaxed for E2E tests)
  rateLimit(event, 'forgot-password', 20, 15 * 60 * 1000)

  const { email } = await readBody(event)

  if (!email) {
    throw createError({ statusCode: 400, message: '请输入邮箱地址' })
  }

  const user = await UserModel.findByEmail(email)

  // 不管用户是否存在，都返回相同的成功消息（防止邮箱枚举攻击）
  if (user) {
    const config = useRuntimeConfig()
    const token = uuidv4()
    const expiresAt = new Date(Date.now() + Number(config.resetTokenExpiresIn))
    // Invalidate old tokens for this user before creating new one
    await UserModel.invalidateResetTokens(user.id)
    await UserModel.createResetToken(user.id, token, expiresAt)

    try {
      await sendResetPasswordEmail(email, token)
    } catch (error) {
      console.error('[Mail] 发送重置邮件失败:', error)
    }
  }

  return { success: true, message: '如果该邮箱已注册，我们已发送密码重置链接到您的邮箱' }
})
