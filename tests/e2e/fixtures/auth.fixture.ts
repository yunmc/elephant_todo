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
import { test as base, chromium, type Page } from '@playwright/test'

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

  // Register via UI
  await page.goto(`${BASE}/register`)
  await page.waitForFunction(
    () => {
      const el = document.getElementById('__nuxt')
      return el && (el as any).__vue_app__
    },
    { timeout: 15000 },
  )
  await page.getByPlaceholder('请输入用户名').fill(creds.username)
  await page.getByPlaceholder('请输入邮箱').fill(creds.email)
  await page.getByPlaceholder('请输入密码（至少6位）').fill(creds.password)
  await page.getByPlaceholder('请再次输入密码').fill(creds.password)
  await page.getByRole('button', { name: '注册' }).click()
  await page.waitForURL('**/', { timeout: 15000 })

  // Extract tokens from cookies
  const cookies = await page.context().cookies()
  const accessToken = cookies.find(c => c.name === 'accessToken')?.value ?? ''
  const refreshToken = cookies.find(c => c.name === 'refreshToken')?.value ?? ''

  if (!accessToken) throw new Error('Registration succeeded but accessToken cookie not found')

  return { creds, accessToken, refreshToken }
}

/**
 * Register a user once (for serial tests). Call from test.beforeAll().
 * Uses a temporary browser to perform UI registration.
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

  // Launch a temporary browser for UI registration
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  try {
    await page.goto(`${BASE}/register`)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('__nuxt')
        return el && (el as any).__vue_app__
      },
      { timeout: 15000 },
    )
    await page.getByPlaceholder('请输入用户名').fill(creds.username)
    await page.getByPlaceholder('请输入邮箱').fill(creds.email)
    await page.getByPlaceholder('请输入密码（至少6位）').fill(creds.password)
    await page.getByPlaceholder('请再次输入密码').fill(creds.password)
    await page.getByRole('button', { name: '注册' }).click()
    await page.waitForURL('**/', { timeout: 15000 })

    // Extract tokens from cookies
    const cookies = await ctx.cookies()
    const accessToken = cookies.find(c => c.name === 'accessToken')?.value ?? ''
    const refreshToken = cookies.find(c => c.name === 'refreshToken')?.value ?? ''

    if (!accessToken) throw new Error('Registration succeeded but accessToken cookie not found')

    return { creds, tokens: { accessToken, refreshToken } }
  } finally {
    await browser.close()
  }
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
