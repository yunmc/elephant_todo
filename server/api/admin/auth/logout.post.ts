export default defineEventHandler(async (event) => {
  // Admin logout is stateless (JWT) — client just removes the token
  // This endpoint exists for API completeness
  return { success: true, message: '已退出登录' }
})
