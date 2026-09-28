import { expect, test } from '@playwright/test'

// Chrome's fake camera shows a test pattern (no face): the app must start, load MediaPipe,
// enter the ticket check and coach the viewer that no face is visible.
test('boards the train and coaches when no face is visible', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Ночной/ })).toBeVisible()
  await page.getByRole('button', { name: 'Сесть в поезд' }).click()
  await page.getByRole('button', { name: 'Пропустить' }).click() // skip the intro

  await expect(page.getByText('Проверка билета', { exact: false })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Не вижу лица — сядь напротив камеры')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel(/отражение в окне вагона/)).toBeVisible()
  await page.screenshot({ path: 'e2e/__screens__/ticket-no-face.png' })

  // MediaPipe logs its own INFO lines through console.error
  expect(errors.filter((e) => !/favicon|^INFO:/.test(e))).toEqual([])
})
