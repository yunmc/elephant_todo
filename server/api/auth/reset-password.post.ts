import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = body.token
  const password = body.password

  if (!token || !password) {
    throw createError({ statusCode: 400, message: '令牌和新密码为必填项' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, message: '密码长度至少 6 位' })
  }

  const resetToken = await UserModel.findResetToken(token)
  if (!resetToken) {
    throw createError({ statusCode: 400, message: '重置令牌无效' })
  }
  if (resetToken.used) {
    throw createError({ statusCode: 400, message: '重置令牌已被使用' })
  }
  if (new Date() > new Date(resetToken.expires_at)) {
    throw createError({ statusCode: 400, message: '重置令牌已过期' })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  await UserModel.updatePassword(resetToken.user_id, hashedPassword)
  await UserModel.markResetTokenUsed(resetToken.id)

  return { success: true, message: '密码已重置，请使用新密码登录' }
})
