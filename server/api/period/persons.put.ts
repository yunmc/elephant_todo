export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody(event)
  const oldName = (body.old_name || '').trim()
  const newName = (body.new_name || '').trim()

  if (!oldName || !newName) {
    throw createError({ statusCode: 400, statusMessage: '请提供旧名称和新名称' })
  }
  if (oldName === newName) {
    return { success: true, data: 0 }
  }
  if (newName.length > 50) {
    throw createError({ statusCode: 400, statusMessage: '名称不能超过50个字符' })
  }

  // Check if newName already exists for this user
  const existingNames = await PeriodModel.getPersonNames(userId)
  if (existingNames.includes(newName)) {
    throw createError({ statusCode: 400, statusMessage: '该名称已存在' })
  }

  const affected = await PeriodModel.renamePerson(userId, oldName, newName)
  return { success: true, data: affected }
})
