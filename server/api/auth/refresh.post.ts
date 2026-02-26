import jwt from 'jsonwebtoken'
import type { JwtPayload } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { refreshToken } = await readBody(event)

  if (!refreshToken) {
    throw createError({ statusCode: 400, message: '缺少刷新令牌' })
  }

  const config = useRuntimeConfig()

  try {
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret as string) as JwtPayload
    const tokens = generateTokens(decoded.userId, decoded.email)
    return { success: true, data: tokens }
  } catch {
    throw createError({ statusCode: 401, message: '刷新令牌无效或已过期' })
  }
})
