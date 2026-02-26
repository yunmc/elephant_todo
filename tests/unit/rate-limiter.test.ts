/**
 * Rate Limiter — Regression Tests
 *
 * Tests the ACTUAL rateLimit() function from server/utils/rate-limiter.ts.
 * Verifies request counting, window expiration, and 429 error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
// Import actual rate limiter
import { rateLimit } from '../../server/utils/rate-limiter'

describe('rateLimit', () => {
  const mockEvent = {} as any

  beforeEach(() => {
    vi.mocked(getRequestIP).mockReturnValue('192.168.1.1')
  })

  it('should allow first request', () => {
    expect(() => rateLimit(mockEvent, 'test-allow', 5, 60000)).not.toThrow()
  })

  it('should allow up to maxRequests within window', () => {
    const key = `test-max-${Date.now()}`
    for (let i = 0; i < 5; i++) {
      expect(() => rateLimit(mockEvent, key, 5, 60000)).not.toThrow()
    }
  })

  it('should block after exceeding maxRequests', () => {
    const key = `test-block-${Date.now()}`
    // Use up all allowed requests
    for (let i = 0; i < 3; i++) {
      rateLimit(mockEvent, key, 3, 60000)
    }
    // Next one should throw
    try {
      rateLimit(mockEvent, key, 3, 60000)
      expect.unreachable('should have thrown')
    } catch (e: any) {
      expect(e.statusCode).toBe(429)
      expect(e.message).toContain('请求过于频繁')
    }
  })

  it('should allow requests after window expires', () => {
    vi.useFakeTimers()
    const key = `test-expire-${Date.now()}`

    // Exhaust limit
    for (let i = 0; i < 2; i++) {
      rateLimit(mockEvent, key, 2, 1000)
    }
    expect(() => rateLimit(mockEvent, key, 2, 1000)).toThrow()

    // Advance time past the window
    vi.advanceTimersByTime(1100)

    // Should be allowed again
    expect(() => rateLimit(mockEvent, key, 2, 1000)).not.toThrow()

    vi.useRealTimers()
  })

  it('should track different IPs separately', () => {
    const key = `test-ip-${Date.now()}`

    // IP 1 uses up limit
    vi.mocked(getRequestIP).mockReturnValue('10.0.0.1')
    for (let i = 0; i < 2; i++) {
      rateLimit(mockEvent, key, 2, 60000)
    }
    expect(() => rateLimit(mockEvent, key, 2, 60000)).toThrow()

    // IP 2 should still be allowed
    vi.mocked(getRequestIP).mockReturnValue('10.0.0.2')
    expect(() => rateLimit(mockEvent, key, 2, 60000)).not.toThrow()
  })

  it('should track different keys separately', () => {
    const key1 = `test-key1-${Date.now()}`
    const key2 = `test-key2-${Date.now()}`
    vi.mocked(getRequestIP).mockReturnValue('10.0.0.99')

    // Exhaust key1
    for (let i = 0; i < 2; i++) {
      rateLimit(mockEvent, key1, 2, 60000)
    }
    expect(() => rateLimit(mockEvent, key1, 2, 60000)).toThrow()

    // key2 should still work
    expect(() => rateLimit(mockEvent, key2, 2, 60000)).not.toThrow()
  })

  it('should include retry-after info in error message', () => {
    const key = `test-retry-${Date.now()}`
    rateLimit(mockEvent, key, 1, 30000)
    try {
      rateLimit(mockEvent, key, 1, 30000)
      expect.unreachable('should have thrown')
    } catch (e: any) {
      expect(e.message).toMatch(/\d+/)
      expect(e.message).toContain('秒后重试')
    }
  })

  it('should handle unknown IP gracefully', () => {
    vi.mocked(getRequestIP).mockReturnValue(undefined as any)
    const key = `test-unknown-${Date.now()}`
    expect(() => rateLimit(mockEvent, key, 5, 60000)).not.toThrow()
  })
})
