import type { AttachmentTargetType } from '~~/server/types'

const VALID_TARGET_TYPES: AttachmentTargetType[] = ['finance_record', 'idea', 'todo']

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  await requirePremium(userId)

  // readMultipartFormData 是 h3 内置方法，解析 multipart/form-data
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: '未上传文件' })
  }

  // 从 form fields 提取 target_type 和 target_id
  let targetType: AttachmentTargetType | undefined
  let targetId: number | undefined

  const fileField = formData.find(f => f.name === 'file')
  for (const field of formData) {
    if (field.name === 'target_type') {
      const val = field.data.toString('utf-8')
      if (VALID_TARGET_TYPES.includes(val as AttachmentTargetType)) {
        targetType = val as AttachmentTargetType
      }
    }
    if (field.name === 'target_id') {
      targetId = Number(field.data.toString('utf-8'))
    }
  }

  if (!targetType || !VALID_TARGET_TYPES.includes(targetType)) {
    throw createError({ statusCode: 400, message: 'target_type 无效' })
  }
  if (!targetId || !Number.isInteger(targetId) || targetId <= 0) {
    throw createError({ statusCode: 400, message: 'target_id 无效' })
  }
  if (!fileField || !fileField.data) {
    throw createError({ statusCode: 400, message: '未上传文件' })
  }

  const mimeType = fileField.type || 'application/octet-stream'
  const fileSize = fileField.data.length
  const originalFilename = fileField.filename || 'upload.jpg'

  // 校验文件格式和大小
  validateUploadFile(mimeType, fileSize, 'attachment')

  // 生成 OSS key 并上传
  const ossKey = ossKeyAttachment(userId, originalFilename)
  const url = await uploadToOss(ossKey, fileField.data, mimeType)

  // 入库
  const currentCount = await AttachmentModel.countByTarget(userId, targetType, targetId)
  const attachmentId = await AttachmentModel.create({
    user_id: userId,
    target_type: targetType,
    target_id: targetId,
    filename: originalFilename,
    oss_key: ossKey,
    url,
    file_size: fileSize,
    mime_type: mimeType,
    sort_order: currentCount,
  })

  const attachment = await AttachmentModel.findById(attachmentId, userId)

  setResponseStatus(event, 201)
  return { success: true, data: attachment, message: '上传成功' }
})
