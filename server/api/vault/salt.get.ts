export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const salt = await UserModel.getVaultSalt(userId)
  return { success: true, data: { salt } }
})
