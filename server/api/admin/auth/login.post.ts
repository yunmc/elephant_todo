import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body || {}

  if (!username || !password) {
    throw createError({ statusCode: 400, message: '请输入用户名和密码' })
  }

  const admin = await AdminUserModel.findByUsername(username)
  if (!admin) {
    throw createError({ statusCode: 401, message: '用户名或密码错误' })
  }

  const valid = await bcrypt.compare(password, admin.password)
  if (!valid) {
    throw createError({ statusCode: 401, message: '用户名或密码错误' })
  }

  // Update last login
  await AdminUserModel.updateLastLogin(admin.id)

  const token = generateAdminToken(admin.id, admin.role)

  return {
    success: true,
    data: {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    },
  }
})
