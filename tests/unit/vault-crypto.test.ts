// @vitest-environment happy-dom
/**
 * Vault Crypto — Regression Tests
 *
 * Tests the ACTUAL useVaultCrypto composable:
 *   - encrypt ↔ decrypt round-trip (AES-256-GCM)
 *   - PBKDF2 key derivation
 *   - Salt generation
 *   - Password generation (crypto.getRandomValues)
 *
 * Uses happy-dom to provide Web Crypto API.
 */
import { describe, it, expect } from 'vitest'
import { useVaultCrypto } from '../../composables/useVaultCrypto'

describe('useVaultCrypto — encrypt/decrypt round-trip', () => {
  const crypto = useVaultCrypto()
  const testPassword = 'MyMasterPassword123!'

  it('should generate a valid base64 salt', () => {
    const salt = crypto.generateSalt()
    expect(salt).toBeTruthy()
    // Valid base64 should decode without error
    const decoded = atob(salt)
    expect(decoded.length).toBe(16) // 16 bytes
  })

  it('should generate different salts each time', () => {
    const salt1 = crypto.generateSalt()
    const salt2 = crypto.generateSalt()
    expect(salt1).not.toBe(salt2)
  })

  it('should encrypt and decrypt data successfully', async () => {
    const salt = crypto.generateSalt()
    const originalData = {
      username: 'user@example.com',
      password: 'SuperSecret123!',
      notes: 'Test notes with unicode: 中文测试 🔒',
    }

    const encrypted = await crypto.encrypt(originalData, testPassword, salt)
    expect(encrypted).toBeTruthy()
    expect(typeof encrypted).toBe('string')

    const decrypted = await crypto.decrypt(encrypted, testPassword, salt)
    expect(decrypted).toEqual(originalData)
  })

  it('should produce different ciphertext for same plaintext (random IV)', async () => {
    const salt = crypto.generateSalt()
    const data = { username: 'a', password: 'b', notes: '' }

    const enc1 = await crypto.encrypt(data, testPassword, salt)
    const enc2 = await crypto.encrypt(data, testPassword, salt)

    expect(enc1).not.toBe(enc2) // Different IV → different ciphertext
  })

  it('should fail to decrypt with wrong password', async () => {
    const salt = crypto.generateSalt()
    const data = { username: 'test', password: 'secret', notes: '' }

    const encrypted = await crypto.encrypt(data, testPassword, salt)

    await expect(
      crypto.decrypt(encrypted, 'WrongPassword', salt),
    ).rejects.toThrow()
  })

  it('should fail to decrypt with wrong salt', async () => {
    const salt1 = crypto.generateSalt()
    const salt2 = crypto.generateSalt()
    const data = { username: 'test', password: 'secret', notes: '' }

    const encrypted = await crypto.encrypt(data, testPassword, salt1)

    await expect(
      crypto.decrypt(encrypted, testPassword, salt2),
    ).rejects.toThrow()
  })

  it('should handle empty fields', async () => {
    const salt = crypto.generateSalt()
    const data = { username: '', password: '', notes: '' }

    const encrypted = await crypto.encrypt(data, testPassword, salt)
    const decrypted = await crypto.decrypt(encrypted, testPassword, salt)
    expect(decrypted).toEqual(data)
  })

  it('should handle large data', async () => {
    const salt = crypto.generateSalt()
    const largeNotes = 'x'.repeat(10000)
    const data = { username: 'user', password: 'pass', notes: largeNotes }

    const encrypted = await crypto.encrypt(data, testPassword, salt)
    const decrypted = await crypto.decrypt(encrypted, testPassword, salt)
    expect(decrypted.notes).toBe(largeNotes)
  })
})

describe('useVaultCrypto — password generator', () => {
  const { generatePassword } = useVaultCrypto()

  it('should generate password with default length of 16', () => {
    const pwd = generatePassword()
    expect(pwd.length).toBe(16)
  })

  it('should generate password with custom length', () => {
    const pwd = generatePassword({ length: 32 })
    expect(pwd.length).toBe(32)
  })

  it('should generate password with only lowercase', () => {
    const pwd = generatePassword({ length: 100, uppercase: false, numbers: false, symbols: false })
    expect(pwd).toMatch(/^[a-z]+$/)
  })

  it('should generate password with only numbers', () => {
    const pwd = generatePassword({ length: 100, uppercase: false, lowercase: false, symbols: false })
    expect(pwd).toMatch(/^[0-9]+$/)
  })

  it('should generate password with only uppercase', () => {
    const pwd = generatePassword({ length: 100, lowercase: false, numbers: false, symbols: false })
    expect(pwd).toMatch(/^[A-Z]+$/)
  })

  it('should generate password with only symbols', () => {
    const pwd = generatePassword({ length: 100, uppercase: false, lowercase: false, numbers: false })
    expect(pwd).toMatch(/^[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$/)
  })

  it('should fallback when all options disabled', () => {
    const pwd = generatePassword({ uppercase: false, lowercase: false, numbers: false, symbols: false })
    expect(pwd.length).toBe(16)
    expect(pwd).toMatch(/^[a-z0-9]+$/)
  })

  it('should generate unique passwords (crypto-random)', () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generatePassword()))
    expect(passwords.size).toBe(50)
  })

  it('should respect minimum length of 1', () => {
    const pwd = generatePassword({ length: 1 })
    expect(pwd.length).toBe(1)
  })
})
