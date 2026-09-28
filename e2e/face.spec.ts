import { existsSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { FACE_VIDEO } from './faceVideo'

// Chrome plays e2e/fixtures/face.y4m as the webcam: neutral face → smile → frown → head turn left.
// The ticket check must pass calibration and those gestures by RECOGNITION (not by its 20 s timeout).
test.skip(!existsSync(FACE_VIDEO), 'run `npm run e2e:fixture` first to build the face video')

test('recognizes calibration, smile, frown and a head turn from a real-looking face', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Сесть в поезд' }).click()
  await page.getByRole('button', { name: 'Пропустить' }).click() // the intro is covered by the journey test
  const panel = page.locator('.ticket-panel')

  await expect(panel).toHaveAttribute('data-passed', '1', { timeout: 15_000 }) // calibration
  await expect(panel).toHaveAttribute('data-passed', '2', { timeout: 15_000 }) // smile
  await expect(panel).toHaveAttribute('data-passed', '3', { timeout: 15_000 }) // frown
  await expect(panel).toHaveAttribute('data-passed', '4', { timeout: 15_000 }) // head turn left
  await page.screenshot({ path: 'e2e/__screens__/ticket-face.png' })
})
