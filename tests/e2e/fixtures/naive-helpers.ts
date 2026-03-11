/**
 * NaiveUI component test helpers — event-driven waits replacing waitForTimeout.
 *
 * NaiveUI renders many interactive components (Select, Modal, DatePicker, Popconfirm)
 * into teleported DOM containers. These helpers wait for the correct DOM state
 * instead of using arbitrary timeouts.
 */
import { expect, type Page } from '@playwright/test'

/** Wait for a NaiveUI select dropdown menu to appear (teleported to body) */
export async function waitForSelectOpen(page: Page, timeout = 3000) {
  await expect(page.locator('.n-base-select-menu')).toBeVisible({ timeout })
}

/** Wait for a NaiveUI select dropdown menu to close */
export async function waitForSelectClose(page: Page, timeout = 3000) {
  await expect(page.locator('.n-base-select-menu')).not.toBeVisible({ timeout })
}

/** Wait for a NaiveUI modal to appear */
export async function waitForModalOpen(page: Page, timeout = 5000) {
  await expect(page.locator('.n-modal').first()).toBeVisible({ timeout })
}

/** Wait for all NaiveUI modals to close */
export async function waitForModalClose(page: Page, timeout = 5000) {
  await expect(page.locator('.n-modal')).not.toBeVisible({ timeout })
}

/** Wait for a NaiveUI date picker panel to appear */
export async function waitForDatePickerOpen(page: Page, timeout = 3000) {
  await expect(page.locator('.n-date-panel')).toBeVisible({ timeout })
}

/** Wait for a NaiveUI date picker panel to close */
export async function waitForDatePickerClose(page: Page, timeout = 3000) {
  await expect(page.locator('.n-date-panel')).not.toBeVisible({ timeout })
}

/**
 * Open a NaiveUI select, pick an option by text, and wait for it to close.
 * @param selectLocator - Locator for the select trigger (e.g. .n-select or .n-base-selection)
 * @param optionText - The visible text of the option to click
 */
export async function selectOption(page: Page, selectLocator: import('@playwright/test').Locator, optionText: string) {
  await selectLocator.click()
  await waitForSelectOpen(page)
  await page.locator('.n-base-select-option__content').filter({ hasText: optionText }).click()
  await waitForSelectClose(page)
}

/**
 * Dismiss a NaiveUI modal by pressing Escape and waiting for it to close.
 */
export async function dismissModal(page: Page) {
  await page.keyboard.press('Escape')
  await waitForModalClose(page)
}
