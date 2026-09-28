import { expect, test, type Page } from '@playwright/test'

/**
 * The whole user journey on the scripted mock camera (?mock=1): title → intro → ticket check (every
 * gesture first done WRONG to check the error-mode hint, then right) → film with three decisions →
 * result ticket. Logs how long each stage takes, screenshots every stage, and checks that no two
 * pieces of on-screen text overlap.
 */

type Face = Readonly<Record<string, number>>
const NEUTRAL: Face = {}
const SMILE: Face = { mouthSmileLeft: 0.85, mouthSmileRight: 0.85, eyeSquintLeft: 0.5, eyeSquintRight: 0.5 }
const MOUTH_ONLY_SMILE: Face = { mouthSmileLeft: 0.85, mouthSmileRight: 0.85 }
const FROWN: Face = { browDownLeft: 0.7, browDownRight: 0.7 }
const ONE_BROW: Face = { browDownLeft: 0.8 }
const SURPRISE: Face = { browInnerUp: 0.8, jawOpen: 0.5 }
const BROWS_ONLY: Face = { browInnerUp: 0.8 }
const EYES_CLOSED: Face = { eyeBlinkLeft: 0.95, eyeBlinkRight: 0.95 }
const LEFT: Face = { yaw: 30 }
const RIGHT: Face = { yaw: -30 }

const SHOTS = 'e2e/__screens__/journey'
const TEXT_BLOCKS = [
  '.hint', '.subtitles p', '.choice-prompt', '.gesture-option', '.reflection', '.ticket-step', '.ticket-line',
  '.ticket-gesture', '.knock p', '.intro-card', '.intro-footer', '.choice-clock',
]

async function face(page: Page, patch: Face): Promise<void> {
  await page.evaluate((p) => {
    window.__mockFace?.neutral()
    window.__mockFace?.set(p)
  }, patch)
}

/** Pairs of visible text blocks whose boxes intersect (nested boxes, like a ring inside its card, are fine). */
async function overlaps(page: Page): Promise<string[]> {
  return page.evaluate((selectors) => {
    const boxes = selectors.flatMap((selector) => [...document.querySelectorAll(selector)].map((el) => ({
      selector,
      rect: el.getBoundingClientRect(),
      visible: getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.05,
    }))).filter((b) => b.visible && b.rect.width > 0 && b.rect.height > 0)
    const inside = (a: DOMRect, b: DOMRect) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1
    const hits: string[] = []
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].rect
        const b = boxes[j].rect
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (ix > 4 && iy > 4 && !inside(a, b) && !inside(b, a)) hits.push(`${boxes[i].selector} × ${boxes[j].selector}`)
      }
    }
    return hits
  }, TEXT_BLOCKS)
}

function stopwatch() {
  const started = Date.now()
  let last = started
  const laps: string[] = []
  return {
    lap(label: string) {
      const now = Date.now()
      laps.push(`${label}: ${((now - last) / 1000).toFixed(1)} s`)
      last = now
    },
    report: () => [...laps, `total: ${((Date.now() - started) / 1000).toFixed(1)} s`],
  }
}

async function stage(page: Page, name: string, found: Map<string, string[]>): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
  const hits = await overlaps(page)
  if (hits.length) found.set(name, hits)
}

async function expectHint(page: Page, text: RegExp): Promise<void> {
  await expect(page.locator('.hint').filter({ hasText: text })).toBeVisible({ timeout: 6000 })
}

async function passStep(page: Page, gesture: Face, passedCount: number): Promise<void> {
  await face(page, gesture)
  await expect(page.locator('.ticket-panel')).toHaveAttribute('data-passed', String(passedCount), { timeout: 8000 })
  await face(page, NEUTRAL)
}

test('full journey with every error hint and the "new conductor" ending', async ({ page }) => {
  test.setTimeout(240_000)
  const overlapsFound = new Map<string, string[]>()
  const time = stopwatch()

  await page.goto('/?mock=1')
  await stage(page, '01-title', overlapsFound)
  await page.getByRole('button', { name: 'Сесть в поезд' }).click()

  // intro: four cards, hands-free
  for (const card of ['world', 'you', 'gestures', 'ticket']) {
    await expect(page.locator(`.intro-screen[data-card="${card}"]`)).toBeVisible({ timeout: 12_000 })
    await page.waitForTimeout(1200)
    await stage(page, `02-intro-${card}`, overlapsFound)
  }
  time.lap('intro')

  // ticket check: calibration on the neutral face, then each gesture wrong first, then right
  const panel = page.locator('.ticket-panel')
  await expect(panel).toHaveAttribute('data-passed', '1', { timeout: 20_000 })
  await expect(panel).toHaveAttribute('data-step', 'smile', { timeout: 5000 })
  await face(page, MOUTH_ONLY_SMILE)
  await expectHint(page, /Улыбка только губами/)
  await stage(page, '03-ticket-smile-hint', overlapsFound)
  await passStep(page, SMILE, 2)

  await expect(panel).toHaveAttribute('data-step', 'frown', { timeout: 5000 })
  await face(page, ONE_BROW)
  await expectHint(page, /Сведи обе брови/)
  await stage(page, '04-ticket-frown-hint', overlapsFound)
  await passStep(page, FROWN, 3)

  await expect(panel).toHaveAttribute('data-step', 'left', { timeout: 5000 })
  await face(page, RIGHT)
  await expectHint(page, /Не в ту сторону/)
  await stage(page, '05-ticket-left-hint', overlapsFound)
  await passStep(page, LEFT, 4)

  await expect(panel).toHaveAttribute('data-step', 'right', { timeout: 5000 })
  await passStep(page, RIGHT, 5)

  await expect(panel).toHaveAttribute('data-step', 'surprise', { timeout: 5000 })
  await face(page, BROWS_ONLY)
  await expectHint(page, /приоткрой рот/)
  await stage(page, '06-ticket-surprise-hint', overlapsFound)
  await passStep(page, SURPRISE, 6)

  await expect(panel).toHaveAttribute('data-step', 'eyes', { timeout: 5000 })
  await face(page, EYES_CLOSED)
  await page.waitForTimeout(1100)
  await face(page, NEUTRAL)
  await expectHint(page, /подсмотрел/)
  await stage(page, '07-ticket-eyes-hint', overlapsFound)
  await passStep(page, EYES_CLOSED, 7)
  time.lap('ticket check')

  // film: three decisions
  const choice = page.locator('.choice-overlay')
  await expect(choice).toBeVisible({ timeout: 30_000 })
  time.lap('film until 1st choice')
  await stage(page, '08-choice-corridor', overlapsFound)
  await face(page, LEFT)
  await expect(choice).toBeHidden({ timeout: 5000 })
  await face(page, NEUTRAL)
  await page.waitForTimeout(1500)
  await stage(page, '09-vestibule', overlapsFound)

  await expect(choice).toBeVisible({ timeout: 30_000 })
  time.lap('to 2nd choice')
  await stage(page, '10-choice-stranger', overlapsFound)
  await face(page, SMILE)
  await expect(choice).toBeHidden({ timeout: 5000 })
  await face(page, NEUTRAL)

  await expect(choice).toBeVisible({ timeout: 30_000 })
  time.lap('to 3rd choice')
  await stage(page, '11-choice-lights-out', overlapsFound)
  await face(page, SURPRISE)
  await expect(choice).toBeHidden({ timeout: 5000 })
  await face(page, NEUTRAL)

  await expect(page.getByRole('heading', { name: 'Новый проводник' })).toBeVisible({ timeout: 40_000 })
  time.lap('to result')
  await page.waitForTimeout(1200)
  await stage(page, '12-result', overlapsFound)
  await expect(page.locator('.ticket-profile')).toContainText('Пошёл на стук')
  await expect(page.locator('.ticket-profile')).toContainText('Доверился')
  await expect(page.locator('.ticket-profile')).toContainText('Окликнул')

  console.log(`\nJOURNEY TIMING\n${time.report().join('\n')}`)
  console.log(`OVERLAPS ${overlapsFound.size ? JSON.stringify(Object.fromEntries(overlapsFound), null, 1) : 'none'}`)
  expect([...overlapsFound.keys()]).toEqual([])
})

test('a viewer who never answers still reaches an ending chosen by mood', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/?mock=1')
  await page.getByRole('button', { name: 'Сесть в поезд' }).click()
  await page.getByRole('button', { name: 'Пропустить' }).click()
  // no gestures at all: every ticket step times out, every choice falls back to the mood layer
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 220_000 })
  await expect(page.locator('.ticket')).toBeVisible({ timeout: 220_000 })
  await page.screenshot({ path: `${SHOTS}/20-no-answers-result.png` })
  await expect(page.locator('.ticket-note').first()).toBeVisible()
})
