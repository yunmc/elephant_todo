import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'

export interface AdminJwtPayload {
  adminId: number
  role: 'operator' | 'super_admin'
}

const ADMIN_JWT_SECRET_SUFFIX = '-admin-panel'

function getAdminSecret(): string {
  const config = useRuntimeConfig()
  return (config.jwtSecret as string) + ADMIN_JWT_SECRET_SUFFIX
}

/**
 * 从请求中提取并验证 Admin JWT，返回 { adminId, role }。
 * 未认证时抛出 401 错误。
 */
export function requireAdminAuth(event: H3Event): AdminJwtPayload {
  const authorization = getHeader(event, 'authorization')

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: '未提供管理员认证令牌' })
  }

  const token = authorization.slice(7)

  try {
    const decoded = jwt.verify(token, getAdminSecret()) as AdminJwtPayload
    return decoded
  } catch {
    throw createError({ statusCode: 401, message: '管理员令牌无效或已过期' })
  }
}

/**
 * 要求 super_admin 角色
 */
export function requireSuperAdminAuth(event: H3Event): AdminJwtPayload {
  const admin = requireAdminAuth(event)
  if (admin.role !== 'super_admin') {
    throw createError({ statusCode: 403, message: '需要超级管理员权限' })
  }
  return admin
}

/**
 * 生成 Admin access token
 */
export function generateAdminToken(adminId: number, role: 'operator' | 'super_admin'): string {
  return jwt.sign(
    { adminId, role } as AdminJwtPayload,
    getAdminSecret(),
    { expiresIn: '12h' }
  )
}
