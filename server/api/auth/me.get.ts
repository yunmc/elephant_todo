export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const user = await UserModel.getSafeUser(userId)

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  return {
    success: true,
    data: { id: user.id, username: user.username, email: user.email, plan: user.plan, plan_expires_at: user.plan_expires_at, auto_renew: !!user.auto_renew, created_at: user.created_at, updated_at: user.updated_at },
  }
})
