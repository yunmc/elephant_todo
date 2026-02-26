import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'

export interface JwtPayload {
  userId: number
  email: string
}

/**
 * 从请求中提取并验证 JWT，返回 userId。
 * 未认证时抛出 401 错误。
 */
export function requireAuth(event: H3Event): number {
  const authorization = getHeader(event, 'authorization')

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: '未提供认证令牌' })
  }

  const token = authorization.slice(7)
  const config = useRuntimeConfig()

  try {
    const decoded = jwt.verify(token, config.jwtSecret as string) as JwtPayload
    return decoded.userId
  } catch {
    throw createError({ statusCode: 401, message: '认证令牌无效或已过期' })
  }
}

/**
 * 生成 access + refresh token 对
 */
export function generateTokens(userId: number, email: string) {
  const config = useRuntimeConfig()

  const accessToken = jwt.sign(
    { userId, email } as JwtPayload,
    config.jwtSecret as string,
    { expiresIn: config.jwtExpiresIn as string }
  )
  const refreshToken = jwt.sign(
    { userId, email } as JwtPayload,
    config.jwtRefreshSecret as string,
    { expiresIn: config.jwtRefreshExpiresIn as string }
  )

  return { accessToken, refreshToken }
}
