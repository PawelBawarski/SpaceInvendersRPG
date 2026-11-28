import { expect, test } from '@playwright/test'
import { ORION_SECTOR_BOUNDS } from '../src/game/domain/exploration'
import { createEmptyMissionProgress } from '../src/game/progress/missionProgress'

const saveKey = 'neon-void:mission-progress:v1'

test('opening or cancelling the galaxy map keeps the pilot in the current galaxy', async ({ page }) => {
  test.setTimeout(45000)
  const progress = {
    ...createEmptyMissionProgress(),
    sectorDistance: ORION_SECTOR_BOUNDS.maxZ - 8,
    shipVitals: { hull: 100, shield: 100 },
  }
  await page.addInitScript(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key: saveKey, save: progress })
  await page.goto('/')
  await page.getByRole('button', { name: 'Wczytaj grę' }).click()
  const canvas = page.getByTestId('flight-canvas')
  await expect(canvas).toBeVisible({ timeout: 20000 })
  await page.keyboard.down('Space')
  const chart = page.getByRole('dialog', { name: 'Mapa galaktyk' })
  await expect(chart).toBeVisible()
  await page.keyboard.up('Space')
  await expect(page.locator('.hyperspace-overlay')).toHaveCount(0)
  await chart.getByRole('button', { name: 'Vesper' }).click()
  await expect(page.locator('.hyperspace-overlay')).toHaveCount(0)
  await chart.getByRole('button', { name: 'Wykonaj skok' }).click()
  await expect(page.locator('.hyperspace-overlay')).toBeVisible()
  await page.getByRole('button', { name: 'Anuluj skok' }).click()
  await expect(chart).toHaveCount(0)
  await expect(page.locator('.hyperspace-overlay')).toHaveCount(0)
  await expect(canvas).toHaveAttribute('data-galaxy-transit', 'idle')
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sectorId, saveKey)).toBe('orion-7')
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sectorDistance, saveKey)).toBeLessThan(ORION_SECTOR_BOUNDS.maxZ)
  await page.waitForTimeout(500)
  await expect(chart).toHaveCount(0)
})

test('closing the galaxy chart without jumping returns the pilot inward', async ({ page }) => {
  test.setTimeout(45000)
  const progress = {
    ...createEmptyMissionProgress(),
    sectorDistance: ORION_SECTOR_BOUNDS.maxZ - 8,
    shipVitals: { hull: 100, shield: 100 },
  }
  await page.addInitScript(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key: saveKey, save: progress })
  await page.goto('/')
  await page.getByRole('button', { name: 'Wczytaj grę' }).click()
  const canvas = page.getByTestId('flight-canvas')
  await expect(canvas).toBeVisible({ timeout: 20000 })
  await page.keyboard.down('Space')
  const chart = page.getByRole('dialog', { name: 'Mapa galaktyk' })
  await expect(chart).toBeVisible()
  await page.keyboard.up('Space')
  await chart.getByRole('button', { name: 'Zamknij mapę galaktyk' }).click()
  await expect(chart).toHaveCount(0)
  await expect(canvas).toHaveAttribute('data-galaxy-transit', 'idle')
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sectorId, saveKey)).toBe('orion-7')
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sectorDistance, saveKey)).toBeLessThan(ORION_SECTOR_BOUNDS.maxZ)
})

