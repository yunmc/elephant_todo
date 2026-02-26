/**
 * Shared Playwright fixture — auto-registers a temp user and provides
 * `authedPage` (a Page already logged-in via cookie injection).
 *
 * For per-test isolation: use `authedPage` fixture (creates new user each test).
 * For serial tests sharing state: use `registerOnce()` + `injectAuth()`.
 *
 * The Nuxt app authenticates via cookies: `accessToken` + `refreshToken`
 * (set by `useCookie()` in stores/auth.ts).
 */
import { test as base, type Page } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

export interface AuthFixtures {
  authedPage: Page
  credentials: { email: string; password: string; username: string }
}

async function registerAndInjectCookies(page: Page) {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const creds = {
    username: `e2e_${rand}`,
    email: `e2e_${ts}_${rand}@test.com`,
    password: 'Test123456',
  }

  // Register via API
  const resp = await page.request.post(`${BASE}/api/auth/register`, {
    data: creds,
  })
  const body = await resp.json()
  if (!body.success) throw new Error(`Register failed: ${JSON.stringify(body)}`)

  const { accessToken, refreshToken } = body.data

  // Parse the URL to get domain
  const url = new URL(BASE)

  // Inject auth cookies — matches Nuxt useCookie('accessToken') / useCookie('refreshToken')
  await page.context().addCookies([
    {
      name: 'accessToken',
      value: accessToken,
      domain: url.hostname,
      path: '/',
    },
    {
      name: 'refreshToken',
      value: refreshToken,
      domain: url.hostname,
      path: '/',
    },
  ])

  return { creds, accessToken, refreshToken }
}

/**
 * Register a user once (for serial tests). Call from test.beforeAll().
 * Returns creds + tokens for injection in each test via injectAuth().
 */
export async function registerOnce(): Promise<{
  creds: { username: string; email: string; password: string }
  tokens: { accessToken: string; refreshToken: string }
}> {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const creds = {
    username: `e2e_${rand}`,
    email: `e2e_${ts}_${rand}@test.com`,
    password: 'Test123456',
  }

  const resp = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  })
  const body = await resp.json() as any
  if (!body.success) throw new Error(`Register failed: ${JSON.stringify(body)}`)

  return { creds, tokens: body.data }
}

/**
 * Inject auth cookies into a page (for serial tests).
 * Call from test.beforeEach() with tokens from registerOnce().
 */
export async function injectAuth(page: Page, tokens: { accessToken: string; refreshToken: string }) {
  const url = new URL(BASE)
  await page.context().addCookies([
    { name: 'accessToken', value: tokens.accessToken, domain: url.hostname, path: '/' },
    { name: 'refreshToken', value: tokens.refreshToken, domain: url.hostname, path: '/' },
  ])
}

/**
 * Hide Nuxt DevTools overlay that intercepts pointer events during E2E tests.
 * Uses MutationObserver to catch the DevTools container when it's injected.
 */
export async function hideDevToolsOverlay(page: Page) {
  await page.addInitScript(() => {
    const hide = () => {
      const el = document.getElementById('nuxt-devtools-container')
      if (el) {
        el.style.display = 'none'
        el.style.pointerEvents = 'none'
      }
    }
    // Run immediately + observe for late injection
    hide()
    const observer = new MutationObserver(hide)
    observer.observe(document.documentElement, { childList: true, subtree: true })
  })
}

/**
 * Wait for Vue hydration to complete, then remove Nuxt DevTools overlay.
 * SSR-rendered buttons don't have @click handlers until Vue hydrates.
 * The DevTools overlay (<nuxt-devtools-frame>) intercepts pointer events
 * especially on the bottom nav area.
 */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(
    () => {
      const el = document.getElementById('__nuxt')
      return el && (el as any).__vue_app__
    },
    { timeout: 15000 },
  )
  // Remove DevTools container after hydration — it intercepts pointer events
  await page.evaluate(() => {
    const el = document.getElementById('nuxt-devtools-container')
    if (el) el.remove()
  })
}

export const test = base.extend<AuthFixtures>({
  credentials: async ({ page }, use) => {
    await hideDevToolsOverlay(page)
    const { creds } = await registerAndInjectCookies(page)
    await use(creds)
  },

  authedPage: async ({ page }, use) => {
    await hideDevToolsOverlay(page)
    await registerAndInjectCookies(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
