import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  // Rate limit: 10 attempts per 15 minutes per IP
  rateLimit(event, 'login', 10, 15 * 60 * 1000)

  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, message: '邮箱和密码为必填项' })
  }

  const user = await UserModel.findByEmail(email)
  if (!user) {
    throw createError({ statusCode: 401, message: '邮箱或密码错误' })
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    throw createError({ statusCode: 401, message: '邮箱或密码错误' })
  }

  const tokens = generateTokens(user.id, user.email)

  return {
    success: true,
    data: {
      user: { id: user.id, username: user.username, email: user.email, plan: user.plan, plan_expires_at: user.plan_expires_at, auto_renew: !!user.auto_renew },
      ...tokens,
    },
    message: '登录成功',
  }
})
