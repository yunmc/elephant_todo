import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody(event)
  const currentPassword = body.currentPassword || body.oldPassword
  const newPassword = body.newPassword

  if (!currentPassword || !newPassword) {
    throw createError({ statusCode: 400, message: '旧密码和新密码为必填项' })
  }
  if (newPassword.length < 6) {
    throw createError({ statusCode: 400, message: '新密码长度至少 6 位' })
  }

  const user = await UserModel.findById(userId)
  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  const isOldPasswordValid = await bcrypt.compare(currentPassword, user.password)
  if (!isOldPasswordValid) {
    throw createError({ statusCode: 401, message: '旧密码错误' })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12)
  await UserModel.updatePassword(user.id, hashedPassword)

  return { success: true, message: '密码修改成功' }
})
