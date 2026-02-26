/**
 * Auth JWT — Regression Tests
 *
 * Tests the ACTUAL requireAuth() and generateTokens() functions
 * from server/utils/auth.ts by importing them with mocked Nitro globals.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'

// Import actual auth functions — Nitro globals are stubbed in setup.ts
import { requireAuth, generateTokens } from '../../server/utils/auth'

const JWT_SECRET = 'test-jwt-secret-key-for-testing'
const JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing'

describe('generateTokens', () => {
  it('should return accessToken and refreshToken', () => {
    const tokens = generateTokens(1, 'user@test.com')
    expect(tokens).toHaveProperty('accessToken')
    expect(tokens).toHaveProperty('refreshToken')
    expect(typeof tokens.accessToken).toBe('string')
    expect(typeof tokens.refreshToken).toBe('string')
  })

  it('accessToken should contain correct userId and email', () => {
    const tokens = generateTokens(42, 'alice@example.com')
    const decoded = jwt.verify(tokens.accessToken, JWT_SECRET) as any
    expect(decoded.userId).toBe(42)
    expect(decoded.email).toBe('alice@example.com')
  })

  it('refreshToken should be verifiable with refresh secret', () => {
    const tokens = generateTokens(1, 'a@b.com')
    const decoded = jwt.verify(tokens.refreshToken, JWT_REFRESH_SECRET) as any
    expect(decoded.userId).toBe(1)
    expect(decoded.email).toBe('a@b.com')
  })

  it('accessToken should NOT be verifiable with refresh secret', () => {
    const tokens = generateTokens(1, 'a@b.com')
    expect(() => jwt.verify(tokens.accessToken, JWT_REFRESH_SECRET)).toThrow()
  })

  it('refreshToken should NOT be verifiable with access secret', () => {
    const tokens = generateTokens(1, 'a@b.com')
    expect(() => jwt.verify(tokens.refreshToken, JWT_SECRET)).toThrow()
  })

  it('tokens should have expiration claims', () => {
    const tokens = generateTokens(1, 'a@b.com')
    const atDecoded = jwt.decode(tokens.accessToken) as any
    const rtDecoded = jwt.decode(tokens.refreshToken) as any
    expect(atDecoded.exp).toBeDefined()
    expect(rtDecoded.exp).toBeDefined()
    // refresh should expire later than access
    expect(rtDecoded.exp).toBeGreaterThan(atDecoded.exp)
  })
})

describe('requireAuth', () => {
  const mockEvent = {} as any

  beforeEach(() => {
    vi.mocked(getHeader).mockReset()
  })

  it('should extract userId from valid Bearer token', () => {
    const token = jwt.sign({ userId: 7, email: 'x@y.com' }, JWT_SECRET, { expiresIn: '1h' })
    vi.mocked(getHeader).mockReturnValue(`Bearer ${token}`)

    const userId = requireAuth(mockEvent)
    expect(userId).toBe(7)
  })

  it('should throw 401 when no authorization header', () => {
    vi.mocked(getHeader).mockReturnValue(undefined)
    expect(() => requireAuth(mockEvent)).toThrow('未提供认证令牌')
    try {
      requireAuth(mockEvent)
    } catch (e: any) {
      expect(e.statusCode).toBe(401)
    }
  })

  it('should throw 401 when authorization header is not Bearer', () => {
    vi.mocked(getHeader).mockReturnValue('Basic abc123')
    expect(() => requireAuth(mockEvent)).toThrow('未提供认证令牌')
  })

  it('should throw 401 for invalid token', () => {
    vi.mocked(getHeader).mockReturnValue('Bearer invalid.token.here')
    expect(() => requireAuth(mockEvent)).toThrow('认证令牌无效或已过期')
    try {
      requireAuth(mockEvent)
    } catch (e: any) {
      expect(e.statusCode).toBe(401)
    }
  })

  it('should throw 401 for expired token', () => {
    const token = jwt.sign(
      { userId: 1, email: 'x@y.com' },
      JWT_SECRET,
      { expiresIn: '0s' }, // immediately expired
    )
    vi.mocked(getHeader).mockReturnValue(`Bearer ${token}`)
    expect(() => requireAuth(mockEvent)).toThrow('认证令牌无效或已过期')
  })

  it('should throw 401 for token signed with wrong secret', () => {
    const token = jwt.sign({ userId: 1, email: 'x@y.com' }, 'wrong-secret', { expiresIn: '1h' })
    vi.mocked(getHeader).mockReturnValue(`Bearer ${token}`)
    expect(() => requireAuth(mockEvent)).toThrow('认证令牌无效或已过期')
  })

  it('should throw 401 when Bearer prefix is empty', () => {
    vi.mocked(getHeader).mockReturnValue('Bearer ')
    expect(() => requireAuth(mockEvent)).toThrow()
  })
})
