export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody(event)
  const { username } = body || {}

  if (!username || typeof username !== 'string' || !username.trim()) {
    throw createError({ statusCode: 400, message: '用户名不能为空' })
  }

  const trimmed = username.trim()
  if (trimmed.length < 2 || trimmed.length > 20) {
    throw createError({ statusCode: 400, message: '用户名长度需在2-20个字符之间' })
  }

  // Check uniqueness
  const existing = await UserModel.findByUsername(trimmed)
  if (existing && existing.id !== userId) {
    throw createError({ statusCode: 409, message: '该用户名已被占用' })
  }

  await UserModel.updateUsername(userId, trimmed)

  const user = await UserModel.findById(userId)
  return {
    success: true,
    data: {
      id: user!.id,
      username: user!.username,
      email: user!.email,
      created_at: user!.created_at,
      updated_at: user!.updated_at,
    },
  }
})
