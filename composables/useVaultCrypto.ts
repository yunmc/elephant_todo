import type { VaultDecryptedData } from '~/types'

/**
 * Composable for client-side E2E encryption of vault entries.
 * Uses AES-256-GCM with PBKDF2-derived key from user's login password.
 */
export function useVaultCrypto() {
  const SALT = 'elephant-vault-salt' // Could be per-user in production
  const ITERATIONS = 100000
  const KEY_LENGTH = 256

  async function deriveKey(password: string): Promise<CryptoKey> {
    const enc = new TextEncoder()
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
        salt: enc.encode(SALT),
        iterations: ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  async function encrypt(data: VaultDecryptedData, password: string): Promise<string> {
    const key = await deriveKey(password)
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

  async function decrypt(encryptedData: string, password: string): Promise<VaultDecryptedData> {
    const key = await deriveKey(password)
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

    const array = new Uint32Array(length)
    crypto.getRandomValues(array)
    return Array.from(array, (x) => chars[x % chars.length]).join('')
  }

  return { encrypt, decrypt, generatePassword }
}
