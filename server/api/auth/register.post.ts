import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  // Rate limit: 100 registrations per 15 minutes per IP (relaxed for E2E tests)
  rateLimit(event, 'register', 100, 15 * 60 * 1000)

  const { username, email, password } = await readBody(event)

  if (!username || !email || !password) {
    throw createError({ statusCode: 400, message: '用户名、邮箱和密码为必填项' })
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw createError({ statusCode: 400, message: '请输入有效的邮箱地址' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, message: '密码长度至少 6 位' })
  }

  const existingEmail = await UserModel.findByEmail(email)
  if (existingEmail) {
    throw createError({ statusCode: 409, message: '该邮箱已被注册' })
  }
  const existingUsername = await UserModel.findByUsername(username)
  if (existingUsername) {
    throw createError({ statusCode: 409, message: '该用户名已被占用' })
  }

  const { bcryptRounds } = useRuntimeConfig()
  const hashedPassword = await bcrypt.hash(password, Number(bcryptRounds))

  let userId: number
  try {
    userId = await UserModel.create({ username, email, password: hashedPassword })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      const msg = err.message?.includes('uk_users_email') ? '该邮箱已被注册' : '该用户名已被占用'
      throw createError({ statusCode: 409, message: msg })
    }
    throw err
  }

  const tokens = generateTokens(userId, email)

  // 初始化象币钱包 + 赠送 10 象币
  await WalletModel.getOrCreate(userId)
  await WalletModel.addCoins(userId, 10, 'reward', '新用户注册奖励', 'register', userId)

  return { success: true, data: { user: { id: userId, username, email, plan: 'free' as const, plan_expires_at: null, auto_renew: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...tokens }, message: '注册成功' }
})
