import type { VaultDecryptedData } from '~/types'

/**
 * Composable for client-side E2E encryption of vault entries.
 * Uses AES-256-GCM with PBKDF2-derived key from user's master password.
 * Salt is per-user (random, stored on server) to prevent cross-user key reuse.
 */
export function useVaultCrypto() {
  const ITERATIONS = 100000
  const KEY_LENGTH = 256

  /** Generate a random 16-byte salt for new users, returned as base64 */
  function generateSalt(): string {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    return btoa(String.fromCharCode(...salt))
  }

  async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
    const enc = new TextEncoder()
    const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0))
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    )
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  async function encrypt(data: VaultDecryptedData, password: string, salt: string): Promise<string> {
    const key = await deriveKey(password, salt)
    const enc = new TextEncoder()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = enc.encode(JSON.stringify(data))

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded,
    )

    // Combine IV + ciphertext and Base64 encode
    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
    combined.set(iv)
    combined.set(new Uint8Array(ciphertext), iv.length)

    return btoa(String.fromCharCode(...combined))
  }

  async function decrypt(encryptedData: string, password: string, salt: string): Promise<VaultDecryptedData> {
    const key = await deriveKey(password, salt)
    const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0))

    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    )

    const dec = new TextDecoder()
    return JSON.parse(dec.decode(decrypted))
  }

  function generatePassword(options: {
    length?: number
    uppercase?: boolean
    lowercase?: boolean
    numbers?: boolean
    symbols?: boolean
  } = {}): string {
    const {
      length = 16,
      uppercase = true,
      lowercase = true,
      numbers = true,
      symbols = true,
    } = options

    let chars = ''
    if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz'
    if (numbers) chars += '0123456789'
    if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'
    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789'

    // Use rejection sampling to avoid modular bias
    const maxValid = Math.floor(0x100000000 / chars.length) * chars.length
    const array = new Uint32Array(length * 2) // extra values for rejection
    crypto.getRandomValues(array)
    let result = ''
    let i = 0
    while (result.length < length) {
      if (i >= array.length) {
        crypto.getRandomValues(array)
        i = 0
      }
      if (array[i] < maxValid) {
        result += chars[array[i] % chars.length]
      }
      i++
    }
    return result
  }

  return { encrypt, decrypt, generatePassword, generateSalt }
}
