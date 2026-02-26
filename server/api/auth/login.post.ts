import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
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
      user: { id: user.id, username: user.username, email: user.email },
      ...tokens,
    },
    message: '登录成功',
  }
})
