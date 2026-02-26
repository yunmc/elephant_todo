export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { salt } = await readBody(event)

  if (!salt || typeof salt !== 'string' || salt.length < 20 || salt.length > 50) {
    throw createError({ statusCode: 400, message: '无效的盐值' })
  }

  // Only allow setting salt once (or if it's null)
  const existing = await UserModel.getVaultSalt(userId)
  if (existing) {
    throw createError({ statusCode: 409, message: '盐值已存在，不可重复设置' })
  }

  await UserModel.setVaultSalt(userId, salt)
  return { success: true, message: '盐值已设置' }
})
