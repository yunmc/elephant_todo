export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  await requirePremium(userId)

  const id = Number(getRouterParam(event, 'id'))
  if (!id || !Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的附件 ID' })
  }

  const attachment = await AttachmentModel.findById(id, userId)
  if (!attachment) {
    throw createError({ statusCode: 404, message: '附件不存在' })
  }

  // 从 OSS 删除文件
  try {
    await deleteFromOss(attachment.oss_key)
  } catch (err) {
    // OSS 删除失败不阻塞数据库清理，记录错误即可
    console.error('OSS delete failed:', attachment.oss_key, err)
  }

  // 从数据库删除记录
  await AttachmentModel.delete(id, userId)

  return { success: true, message: '附件已删除' }
})
