import type { VaultQueryParams } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const groups = await VaultModel.findGroups(userId)
  return { success: true, data: groups }
})
