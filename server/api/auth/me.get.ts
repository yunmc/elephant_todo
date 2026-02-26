export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const user = await UserModel.findById(userId)

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  return {
    success: true,
    data: { id: user.id, username: user.username, email: user.email, created_at: user.created_at },
  }
})
