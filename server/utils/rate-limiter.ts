import type { H3Event } from 'h3'

interface RateLimitEntry {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup expired entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Simple in-memory rate limiter.
 * @param event - H3 request event
 * @param key - Unique key for the rate limit bucket (e.g., 'login', 'forgot-password')
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimit(event: H3Event, key: string, maxRequests: number, windowMs: number): void {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const bucketKey = `${key}:${ip}`
  const now = Date.now()

  let entry = store.get(bucketKey)

  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs }
    store.set(bucketKey, entry)
  }

  entry.count++

  if (entry.count > maxRequests) {
    const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000)
    throw createError({
      statusCode: 429,
      message: `请求过于频繁，请 ${retryAfterSec} 秒后重试`,
    })
  }
}
