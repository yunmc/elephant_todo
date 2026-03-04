
export default defineEventHandler(async (event) => {
  const { adminId, role } = requireAdminAuth(event)

  const admin = await AdminUserModel.findById(adminId)
  if (!admin) {
    throw createError({ statusCode: 401, message: '管理员账号不存在' })
  }

  return {
    success: true,
    data: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      last_login_at: admin.last_login_at,
      created_at: admin.created_at,
    },
  }
})
