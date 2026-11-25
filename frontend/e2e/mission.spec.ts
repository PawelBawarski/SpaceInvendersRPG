import { expect, test, type Page } from '@playwright/test'
import { ORION_PLANETS, ORION_STATIONS, ORION_SUN } from '../src/game/domain/exploration'
import { getMission } from '../src/game/missions/definitions'
import { createEmptyMissionProgress, type MissionProgress } from '../src/game/progress/missionProgress'

const SAVE_KEY = 'neon-void:mission-progress:v1'
const canvasLabel = 'Neon Void explorable space sector'

async function loadWorld(page: Page, changes: Partial<MissionProgress> = {}) {
  await page.addInitScript(({ key, progress }) => {
    localStorage.setItem(key, JSON.stringify(progress))
  }, { key: SAVE_KEY, progress: { ...createEmptyMissionProgress(), ...changes } })
  await page.goto('/')
  await page.getByRole('button', { name: 'Wczytaj grę' }).click()
  await expect(page.getByLabel(canvasLabel)).toBeVisible({ timeout: 20000 })
  await attachScene(page)
}

async function attachScene(page: Page) {
  const source = await (await page.request.get('/src/game/renderer/SectorCanvas.tsx')).text()
  const coreURL = source.match(/from "([^"]*@babylonjs_core\.js[^"]*)"/)?.[1]
  if (!coreURL) throw new Error('Babylon module not found in Vite source')
  await page.evaluate(async url => { (window as any).__core = await import(url) }, coreURL)
  await page.waitForFunction(label => {
    const scenes = (window as any).__core.EngineStore.Instances.flatMap((engine: any) => engine.scenes)
    const scene = scenes.find((entry: any) => entry.getEngine().getRenderingCanvas()?.getAttribute('aria-label') === label)
    if (!scene?.isReady()) return false
    ;(window as any).__world = scene
    return true
  }, canvasLabel)
}

async function flightState(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).__world
    const ship = scene.getTransformNodeByName('playerShip')
    const lines = scene.getMeshByName('flightSpeedStreaks')
    return {
      sceneId: scene.uid, roll: ship.rotation.z,
      position: { x: ship.position.x, y: ship.position.y, z: ship.position.z },
      streaks: lines.isEnabled() && lines.alpha > 0,
      exhaustRate: scene.particleSystems.reduce((sum: number, entry: any) => sum + entry.emitRate, 0),
    }
  })
}

test('new game starts in the galaxy with persistent vitals and rechargeable dodge', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Wczytaj grę' })).toBeDisabled()
  await page.getByRole('button', { name: 'Nowa gra', exact: true }).click()
  await expect(page.getByLabel(canvasLabel)).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('progressbar', { name: 'Osłony', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Kadłub', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Unik' })).toHaveAttribute('aria-valuenow', '100')
  await page.keyboard.press('k')
  await expect(page.getByRole('progressbar', { name: 'Unik' })).not.toHaveAttribute('aria-valuenow', '100')
  await expect(page.getByRole('progressbar', { name: 'Unik' })).toHaveAttribute('aria-valuenow', '100', { timeout: 10000 })
  await expect(page.locator('.pilot-loadout-hud, .pilot-resources-hud, .controls-hint')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /stacji|warsztat|misję/i })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'PAUZA' }).getByRole('button', { name: 'Wyjdź' }).click()
  await expect(page.getByRole('heading', { name: 'NEON VOID' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Wczytaj grę' })).toBeEnabled()
})

test('L opens the cosmic journal, tracks destinations and closes with L or X in the same live world', async ({ page }) => {
  await loadWorld(page, { sectorX: -5000, sectorY: -3000, sectorDistance: 2000 })
  const before = await flightState(page)
  await expect(page.getByRole('button', { name: /Dziennik/ })).toHaveCount(0)
  await page.keyboard.press('l')
  await expect(page.getByRole('heading', { name: 'Dziennik nawigacyjny' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Wróć do lotu|Ustawienia|Tytuł/ })).toHaveCount(0)
  await expect(page.locator('.world-mission-grid:not(.world-station-grid) .world-mission')).toHaveCount(12)
  await expect(page.getByRole('button', { name: /Rozpocznij|warsztat/i })).toHaveCount(0)
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Ostatni admirał' }) }).getByRole('button').click()
  await expect(page.locator('.journal-course-readout')).toContainText('Ostatni admirał')
  await page.keyboard.press('l')
  await expect(page.getByLabel(canvasLabel)).toBeVisible()
  await expect(page.locator('.world-tracked-objective')).toContainText('Ostatni admirał')
  expect(await flightState(page)).toMatchObject(before)
  await page.keyboard.press('l')
  await page.getByRole('button', { name: 'Zamknij dziennik' }).click()
  expect(await flightState(page)).toMatchObject(before)
  await page.keyboard.press('l')
  await expect(page.locator('.world-station-grid article')).toHaveCount(3)
  await page.locator('.world-station-grid article').first().getByRole('button', { name: /Wyznacz kurs/ }).click()
  await page.keyboard.press('l')
  await expect(page.locator('.world-hangar-beacon')).toContainText(ORION_STATIONS[0].name.pl)
  await expect(page.locator('.world-waypoint')).toHaveCount(0)
  expect(await flightState(page)).toMatchObject(before)
  await page.keyboard.press('l')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.app-screen-overlay').evaluate(element => { element.scrollTop = element.scrollHeight })
  const close = page.getByRole('button', { name: 'Zamknij dziennik' })
  const box = await close.boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  await close.click()
  await expect(page.getByLabel(canvasLabel)).toBeVisible()
})

test('pause settings close and retain the live world', async ({ page }) => {
  await loadWorld(page)
  const before = await flightState(page)
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'PAUZA' }).getByRole('button', { name: 'Ustawienia' }).click()
  await expect(page.getByRole('dialog', { name: 'USTAWIENIA LOTU' })).toBeVisible()
  await page.locator('#pause-mainVolume').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('output[for="pause-mainVolume"]')).toHaveText('81%')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Wznów' }).click()
  expect((await flightState(page)).sceneId).toBe(before.sceneId)
})

test('local docking preloads the hangar, lands and launches at the same station', async ({ page }) => {
  test.setTimeout(60000)
  const station = ORION_STATIONS[0]
  await loadWorld(page, { sectorX: station.launchPosition.x, sectorY: station.launchPosition.y, sectorDistance: station.launchPosition.z,
    credits: 1000, scrapMetal: 20, copper: 20, radioactiveResidue: 10, shipVitals: { hull: 40, shield: 20 } })
  await expect(page.getByRole('progressbar', { name: 'Osłony', exact: true })).toHaveAttribute('aria-valuenow', '20')
  await page.getByRole('button', { name: 'Wleć do stacji' }).click()
  await expect(page.getByRole('progressbar', { name: 'Postęp dokowania' })).toBeVisible()
  const hangar = page.locator('canvas.garage-world')
  await expect(hangar).toBeAttached({ timeout: 20000 })
  await expect(hangar).toBeHidden()
  await expect(hangar).toHaveAttribute('data-ready', 'true', { timeout: 25000 })
  await expect.poll(async () => (await flightState(page)).position.z, { timeout: 12000 }).toBeGreaterThan(station.launchPosition.z + 15)
  expect(await page.evaluate(() => {
    const { Vector3 } = (window as any).__core
    return (window as any).__world.getTransformNodeByName('playerShip').getDirection(Vector3.Forward()).z
  })).toBeGreaterThan(0.9)
  await expect(hangar).toBeVisible({ timeout: 30000 })
  await expect(hangar).toHaveAttribute('data-landing-stage', 'deploying')
  await expect(page.locator('.station-landing-status')).toContainText('rozkładanie podpór')
  await expect.poll(async () => Number(await hangar.getAttribute('data-gear-deployment'))).toBeGreaterThan(0.2)
  const deployingLeg = await page.evaluate(() => {
    const scene = (window as any).__core.EngineStore.Instances.flatMap((engine: any) => engine.scenes)
      .find((scene: any) => scene.getTransformNodeByName('hangarPlayerShip'))
    const gear = scene.getTransformNodeByName('hangarLandingGear-0')
    return { enabled: gear.isEnabled(), angle: gear.rotation.x }
  })
  expect(deployingLeg.enabled).toBe(true)
  expect(deployingLeg.angle).toBeGreaterThan(0)
  expect(deployingLeg.angle).toBeLessThan(Math.PI / 2)
  const suspension = await page.evaluate(async () => {
    const scene = (window as any).__core.EngineStore.Instances.flatMap((engine: any) => engine.scenes)
      .find((scene: any) => scene.getTransformNodeByName('hangarPlayerShip'))
    const ship = scene.getTransformNodeByName('hangarPlayerShip')
    const canvas = scene.getEngine().getRenderingCanvas()
    const samples: Array<{ compression: number; y: number; feet: number[] }> = []
    await new Promise<void>(resolve => {
      const observer = scene.onAfterRenderObservable.add(() => {
        if (Number(canvas.dataset.landingProgress) >= 0.82) samples.push({
          compression: Number(canvas.dataset.gearCompression), y: ship.position.y,
          feet: [0, 1, 2].map(index => {
            const foot = scene.getMeshByName(`hangarLandingFoot-${index}`)
            foot.computeWorldMatrix(true)
            return foot.getBoundingInfo().boundingBox.minimumWorld.y
          }),
        })
        if (canvas.dataset.landingState === 'landed') { scene.onAfterRenderObservable.remove(observer); resolve() }
      })
    })
    return samples
  })
  expect(Math.max(...suspension.map(sample => sample.compression))).toBeGreaterThan(0.05)
  expect(Math.min(...suspension.map(sample => sample.y))).toBeLessThan(suspension.at(-1)!.y - 0.01)
  for (const sample of suspension) for (const bottom of sample.feet) expect(bottom).toBeCloseTo(-0.97, 3)
  await expect(hangar).toHaveAttribute('data-landing-state', 'landed', { timeout: 15000 })
  await expect(hangar).toHaveAttribute('data-gear-deployment', '1.000')
  const feet = await page.evaluate(() => {
    const scene = (window as any).__core.EngineStore.Instances.flatMap((engine: any) => engine.scenes)
      .find((scene: any) => scene.getTransformNodeByName('hangarPlayerShip'))
    const pad = scene.getMeshByName('landingPad')
    pad.computeWorldMatrix(true)
    return [0, 1, 2].map(index => {
      const foot = scene.getMeshByName(`hangarLandingFoot-${index}`)
      foot.computeWorldMatrix(true)
      return foot.getBoundingInfo().boundingBox.minimumWorld.y - pad.getBoundingInfo().boundingBox.maximumWorld.y
    })
  })
  for (const height of feet) expect(Math.abs(height)).toBeLessThan(0.001)
  await expect(page.locator('.garage-toolbar')).toContainText(station.name.pl)
  await page.keyboard.press('l')
  await expect(page.getByRole('heading', { name: 'Dziennik nawigacyjny' })).toBeVisible()
  await expect(page.getByLabel(canvasLabel)).toHaveCount(0)
  await page.keyboard.press('l')
  await expect(hangar).toBeVisible()
  await expect.poll(async () => Number(await page.getByRole('progressbar', { name: 'Kadłub', exact: true }).getAttribute('aria-valuenow'))).toBeGreaterThan(45)
  await expect(page.getByRole('progressbar', { name: 'Osłony', exact: true })).toHaveAttribute('aria-valuenow', '20')
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).credits, SAVE_KEY)).toBe(1000)
  await page.getByRole('button', { name: 'Naładuj osłony · 40 KS' }).click()
  await expect(page.getByRole('progressbar', { name: 'Osłony', exact: true })).toHaveAttribute('aria-valuenow', '100')
  await page.getByRole('button', { name: /Wytwórz losowy moduł/ }).click()
  await expect(page.locator('.garage-part-list .garage-part')).toHaveCount(1)
  const crafted = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY)
  expect(crafted.credits).toBe(860)
  expect(crafted.scrapMetal).toBe(16)
  await page.locator('.garage-part-list .garage-part').click({ button: 'right' })
  await expect(page.locator('.garage-part-list .garage-part')).toHaveCount(0)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).credits, SAVE_KEY)).toBeGreaterThan(860)
  await page.getByRole('button', { name: /Opuść hangar|Wyjdź z hangaru/ }).first().click()
  await expect(hangar).toHaveAttribute('data-landing-state', 'departing')
  await expect(hangar).toHaveAttribute('data-gear-deployment', '0.000')
  await expect(page.locator('.garage-toolbar')).toHaveCount(0)
  await expect(page.getByLabel(canvasLabel)).toBeVisible({ timeout: 20000 })
  await attachScene(page)
  await expect(page.getByRole('progressbar', { name: 'Postęp wylotu' })).toBeVisible()
  expect(await page.evaluate(() => (window as any).__world.getMeshByName('flightSpeedStreaks').isEnabled())).toBe(false)
  await expect(page.getByLabel(canvasLabel)).toHaveAttribute('data-station-transit', 'idle', { timeout: 15000 })
  expect((await flightState(page)).position.z).toBeCloseTo(station.launchPosition.z - 140, 0)
  expect(await page.evaluate(() => {
    const { Vector3 } = (window as any).__core
    const ship = (window as any).__world.getTransformNodeByName('playerShip')
    return { forwardZ: ship.getDirection(Vector3.Forward()).z, quaternion: ship.rotationQuaternion }
  })).toMatchObject({ forwardZ: -1, quaternion: null })
  await expect(page.getByRole('progressbar', { name: 'Osłony', exact: true })).toHaveAttribute('aria-valuenow', '100')
})

test('inventory artwork and equipment update the ship without replacing the world', async ({ page }) => {
  await loadWorld(page, {
    experience: 1000,
    shipParts: [
      { id: 'blue-gun', slot: 'weapon', rarity: 'refined', stats: { damagePercent: 12, shieldPoints: 0, hullPoints: 0, enginePercent: 0 } },
      { id: 'purple-shield', slot: 'shield', rarity: 'prototype', stats: { damagePercent: 0, shieldPoints: 25, hullPoints: 0, enginePercent: 0 } },
      { id: 'white-engine', slot: 'engine', rarity: 'standard', stats: { damagePercent: 0, shieldPoints: 0, hullPoints: 0, enginePercent: 5 } },
    ],
  })
  const before = await flightState(page)
  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Ekwipunek pilota' })
  await expect(inventory).toBeVisible()
  await expect(inventory.locator('.pilot-backpack-grid > *')).toHaveCount(36)
  await expect(inventory.locator('.pilot-item svg')).toHaveCount(3)
  await expect(inventory.locator('.pilot-materials svg')).toHaveCount(4)
  await inventory.locator('.pilot-item.rarity-refined').getByRole('button', { name: 'Załóż', exact: true }).click()
  await page.getByRole('button', { name: 'Zamknij ekwipunek' }).click()
  await expect(page.getByLabel(canvasLabel)).toHaveAttribute('data-equipped-parts', 'weapon')
  expect((await flightState(page)).sceneId).toBe(before.sceneId)
  await expect.poll(() => page.evaluate(() => (window as any).__world.getTransformNodeByName('playerShipAppearance').getChildMeshes().find((mesh: any) => mesh.name === 'shipWeaponArmor-1')?.material?.diffuseColor?.toHexString().toLowerCase())).toBe('#62a8ff')
})

test('streaks stop while coasting and bullets overtake the boosting ship', async ({ page }) => {
  test.setTimeout(45000)
  await loadWorld(page, { sectorX: -6000, sectorY: -3000, sectorDistance: 2000 })
  expect((await flightState(page)).streaks).toBe(false)
  await page.keyboard.down('ShiftLeft')
  await expect.poll(async () => (await flightState(page)).streaks, { timeout: 15000 }).toBe(true)
  await expect.poll(async () => (await flightState(page)).exhaustRate).toBeGreaterThan(0)
  await page.keyboard.down('f')
  await expect.poll(() => page.evaluate(() => {
    const scene = (window as any).__world
    const ship = scene.getTransformNodeByName('playerShip')
    return Math.max(0, ...scene.meshes.filter((mesh: any) => mesh.name === 'worldPlayerBolt' && mesh.isEnabled()).map((mesh: any) => mesh.position.z - ship.position.z))
  })).toBeGreaterThan(700)
  await page.keyboard.up('f')
  await page.keyboard.up('ShiftLeft')
  await expect.poll(async () => (await flightState(page)).streaks).toBe(false)
  await expect.poll(async () => (await flightState(page)).exhaustRate).toBe(0)
})

test('Q and E allow full opposite rolls', async ({ page }) => {
  test.setTimeout(45000)
  await loadWorld(page)
  const start = (await flightState(page)).roll
  await page.keyboard.down('q')
  await expect.poll(async () => Math.abs((await flightState(page)).roll - start), { timeout: 15000 }).toBeGreaterThan(Math.PI * 2)
  await page.keyboard.up('q')
  const afterQ = (await flightState(page)).roll
  expect(afterQ - start).toBeGreaterThan(Math.PI * 2)
  await page.keyboard.down('e')
  await expect.poll(async () => Math.abs((await flightState(page)).roll - afterQ), { timeout: 15000 }).toBeGreaterThan(Math.PI * 2)
  await page.keyboard.up('e')
  expect((await flightState(page)).roll - afterQ).toBeLessThan(-Math.PI * 2)
})

test('remote boss is accessible before earlier missions and rewards victory once', async ({ page }) => {
  test.setTimeout(60000)
  const mission = getMission('null-choir')
  await loadWorld(page, { sectorX: mission.worldPosition.x, sectorY: mission.worldPosition.y, sectorDistance: mission.worldPosition.z - 170,
    shipParts: [{ id: 'test-gun', slot: 'weapon', rarity: 'standard', stats: { damagePercent: 100, shieldPoints: 0, hullPoints: 0, enginePercent: 0 } }],
    equippedParts: { weapon: 'test-gun', shield: null, engine: null }, shieldLevel: 30,
  })
  await expect(page.getByRole('progressbar', { name: 'Kadłub bossa' })).toBeVisible()
  await expect(page.locator('.world-boss-vitals')).toContainText(mission.title.pl)
  const bossNameplate = page.locator('.enemy-nameplate[data-enemy-id="world-boss-null-choir"]')
  await expect(bossNameplate).toContainText('Pusty Chór')
  await expect(bossNameplate).toContainText(/LVL \d+/)
  await expect(page.locator('.damage-direction-feedback')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.damage-source-label')).toContainText(mission.title.pl)
  const sizes = await page.evaluate(() => {
    const nodes = (window as any).__world.transformNodes
    const boss = nodes.find((node: any) => node.metadata?.worldEnemyId === 'world-boss-null-choir')
    const enemy = nodes.find((node: any) => node.metadata?.worldEnemyId && !node.metadata.worldEnemyId.startsWith('world-boss'))
    return { bossScale: boss.scaling.x, bossHit: boss.metadata.hitRadius, enemyScale: enemy.scaling.x, enemyType: enemy.metadata.archetype }
  })
  expect(sizes.bossScale).toBeCloseTo(1.9 * 18)
  expect(sizes.bossHit).toBeCloseTo(7.2 * 18)
  expect(sizes.enemyScale).toBeCloseTo((sizes.enemyType === 'scout' ? 0.85 : sizes.enemyType === 'frigate' ? 1.35 : 1.1) * 9)
  await page.keyboard.press('i')
  await expect(page.getByRole('dialog', { name: 'Ekwipunek pilota' })).toHaveCount(0)
  await page.keyboard.down('f')
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).completedMissions, SAVE_KEY), { timeout: 40000 }).toContain('null-choir')
  await page.keyboard.up('f')
  const result = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY)
  expect(result.wardenDefeats).toBe(0)
  expect(result.shipParts.filter((part: any) => part.id === 'boss-null-choir')).toHaveLength(1)
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'PAUZA' }).getByRole('button', { name: 'Wyjdź' }).click()
  await page.getByRole('button', { name: 'Wczytaj grę' }).click()
  await expect(page.getByRole('progressbar', { name: 'Kadłub bossa' })).toHaveCount(0)
  await expect(bossNameplate).toHaveCount(0)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).nullChoirRuns, SAVE_KEY)).toBe(1)
})

test('enemy names follow visible ships and static rendering shares geometry', async ({ page }) => {
  await loadWorld(page, { sectorX: -1200, sectorY: 480, sectorDistance: 5900 })
  const nameplate = page.locator('.enemy-nameplate[data-enemy-id="drone-a"]')
  await expect(nameplate).toContainText('Zwiadowca Meridian')
  await expect(nameplate).toContainText('LVL 3')
  const rendering = await page.evaluate(() => {
    const scene = (window as any).__world
    const proxies = scene.meshes.filter((mesh: any) => mesh.name.startsWith('planet-distant-'))
    const glow = scene.effectLayers.find((layer: any) => layer.name === 'sectorGlow')
    return {
      proxies: proxies.length, geometries: new Set(proxies.map((mesh: any) => mesh.geometry)).size,
      stations: scene.transformNodes.filter((node: any) => node.metadata?.stationId).map((node: any) => node.getChildMeshes().length),
      glowWidth: glow._mainTexture.getSize().width, glowIntensity: glow.intensity, renderWidth: scene.getEngine().getRenderWidth(),
      enemyLevel: scene.transformNodes.find((node: any) => node.metadata?.worldEnemyId === 'drone-a').metadata.enemyLevel,
    }
  })
  expect(rendering).toMatchObject({ proxies: 60, geometries: 1, stations: [4, 4, 4], enemyLevel: 3 })
  expect(rendering.glowWidth).toBeLessThanOrEqual(rendering.renderWidth / 8)
  expect(rendering.glowIntensity).toBeCloseTo(0.18)
  await page.evaluate(() => { (window as any).__world.getTransformNodeByName('playerShip').rotation.y = Math.PI })
  await expect(nameplate).toHaveCount(0)
  await page.evaluate(() => { (window as any).__world.getTransformNodeByName('playerShip').rotation.y = 0 })
  await expect(nameplate).toBeVisible()
})

test('same-faction trios patrol together with stable spacing and visible identities', async ({ page }) => {
  await loadWorld(page, { sectorX: -450, sectorY: 125, sectorDistance: 8870 })
  const readGroup = () => page.evaluate(() => (window as any).__world.transformNodes
    .filter((node: any) => node.metadata?.formationId === 'squadron-1')
    .sort((left: any, right: any) => left.metadata.formationSlot - right.metadata.formationSlot)
    .map((node: any) => ({ id: node.metadata.worldEnemyId, faction: node.metadata.faction,
      x: node.position.x, y: node.position.y, z: node.position.z, heading: node.rotation.y })))
  await expect.poll(async () => (await readGroup()).length).toBe(3)
  await expect(page.locator('.enemy-nameplate[data-enemy-id^="outer-patrol-"]')).toHaveCount(3)
  const before = await readGroup()
  expect(new Set(before.map((ship: any) => ship.faction)).size).toBe(1)
  await expect.poll(async () => {
    const after = await readGroup()
    return Math.hypot(after[0].x - before[0].x, after[0].y - before[0].y, after[0].z - before[0].z)
  }).toBeGreaterThan(6)
  const after = await readGroup()
  const separation = (ships: any[], index: number) => Math.hypot(ships[0].x - ships[index].x, ships[0].y - ships[index].y, ships[0].z - ships[index].z)
  for (let index = 1; index < 3; index++) {
    expect(separation(after, index)).toBeCloseTo(separation(before, index), 2)
    expect(after[index].heading).toBeCloseTo(after[0].heading)
  }
})

test('engine sound changes between thrust, coasting and stopping on the real audio graph', async ({ page }) => {
  test.setTimeout(45000)
  await page.addInitScript(() => {
    const createOscillator = AudioContext.prototype.createOscillator
    ;(window as any).__audioOscillators = []
    AudioContext.prototype.createOscillator = function () {
      const node = createOscillator.call(this)
      ;(window as any).__audioOscillators.push(node)
      return node
    }
  })
  await loadWorld(page, { sectorX: -6000, sectorY: -3000, sectorDistance: 2000 })
  const canvas = page.getByLabel(canvasLabel)
  await expect(canvas).toHaveAttribute('data-engine-sound', 'silent')
  await page.keyboard.down('ShiftLeft')
  await expect(canvas).toHaveAttribute('data-engine-sound', 'acceleration')
  await expect.poll(() => page.evaluate(() => (window as any).__audioOscillators.find((node: any) => node.type === 'triangle')?.frequency.value ?? 0)).toBeGreaterThan(90)
  const boosting = await page.evaluate(() => ({ frequency: (window as any).__audioOscillators.find((node: any) => node.type === 'triangle').frequency.value, state: (window as any).__audioOscillators.find((node: any) => node.type === 'triangle').context.state }))
  expect(boosting.state).toBe('running')
  await page.keyboard.up('ShiftLeft')
  await expect(canvas).toHaveAttribute('data-engine-sound', 'cruise')
  await expect.poll(() => page.evaluate(() => (window as any).__audioOscillators.find((node: any) => node.type === 'triangle').frequency.value)).toBeLessThan(boosting.frequency)
  await expect(canvas).toHaveAttribute('data-engine-sound', 'silent', { timeout: 12000 })
})

test('only the nearest hangar has a marker, without a background or focus border', async ({ page }) => {
  await loadWorld(page)
  const beacon = page.locator('.world-hangar-beacon')
  await expect(beacon).toHaveCount(1)
  await expect(beacon).toHaveAttribute('data-station-id', ORION_STATIONS[0].id)
  await beacon.focus()
  const style = await beacon.evaluate(element => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, border: style.borderStyle, outline: style.outlineStyle, shadow: style.boxShadow }
  })
  expect(style).toEqual({ background: 'rgba(0, 0, 0, 0)', border: 'none', outline: 'none', shadow: 'none' })
  await beacon.click()
  await expect(page.locator('.world-waypoint')).toHaveCount(0)
  await page.evaluate(position => (window as any).__world.getTransformNodeByName('playerShip').position.set(position.x, position.y, position.z), ORION_STATIONS[1].launchPosition)
  await expect(beacon).toHaveCount(1)
  await expect(beacon).toHaveAttribute('data-station-id', ORION_STATIONS[1].id)
  await expect(beacon).toContainText(ORION_STATIONS[1].name.pl)
})

test('C shows current ship statistics and an equipped 3D model while preserving the flight scene', async ({ page }) => {
  test.setTimeout(60000)
  await loadWorld(page, {
    experience: 1000,
    shipParts: [
      { id: 'sheet-weapon', slot: 'weapon', rarity: 'prototype', stats: { damagePercent: 20, hullPoints: 5, shieldPoints: 0, enginePercent: 0 } },
      { id: 'sheet-shield', slot: 'shield', rarity: 'refined', stats: { damagePercent: 0, hullPoints: 0, shieldPoints: 18, enginePercent: 0 }, resistances: { kinetic: 0.1, ion: 0.16 } },
      { id: 'sheet-engine', slot: 'engine', rarity: 'refined', stats: { damagePercent: 0, hullPoints: 0, shieldPoints: 0, enginePercent: 10 }, resistances: { thermal: 0.16 } },
    ],
    equippedParts: { weapon: 'sheet-weapon', shield: 'sheet-shield', engine: 'sheet-engine' },
  })
  const before = await flightState(page)
  await page.keyboard.press('c')
  const sheet = page.getByRole('dialog', { name: 'Statystyki statku' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Obrażenia pocisku', { exact: true }).locator('..').locator('dd')).toHaveText('33–45')
  await expect(sheet.locator('.resistance-thermal dd')).toHaveText('16%')
  await expect(sheet.locator('.ship-stats-module')).toHaveCount(3)
  const preview = sheet.getByLabel('Ship statistics 3D preview')
  await expect(preview).toHaveAttribute('data-equipped-parts', 'weapon,shield,engine')
  await expect(preview).toHaveAttribute('data-ready', 'true', { timeout: 25000 })
  const equipped = await page.evaluate(() => {
    const core = (window as any).__core
    const scene = core.EngineStore.Instances.flatMap((engine: any) => engine.scenes).find((scene: any) => scene.getEngine().getRenderingCanvas()?.classList.contains('ship-stats-preview'))
    return scene.getTransformNodeByName('shipSheetPreview').metadata.equippedPartRarities
  })
  expect(equipped).toEqual({ weapon: 'prototype', shield: 'refined', engine: 'refined' })
  expect(await flightState(page)).toMatchObject(before)
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'PAUZA' })).toHaveCount(0)
  expect((await flightState(page)).sceneId).toBe(before.sceneId)
  await page.keyboard.press('c')
  await expect(sheet).toBeVisible()
  await page.keyboard.press('c')
  await expect(sheet).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as any).__core.EngineStore.Instances.length)).toBe(1)
})

test('old saves near an expanded planet resume safely without hull or shield damage', async ({ page }) => {
  const planet = ORION_PLANETS[0]
  await loadWorld(page, { sectorX: planet.x, sectorY: planet.y, sectorDistance: planet.z - planet.radius / 1.5 - 8,
    shipVitals: { hull: 80, shield: 40 }, completedMissions: ['glass-orbit'] })
  const position = (await flightState(page)).position
  expect(Math.hypot(position.x - planet.x, position.y - planet.y, position.z - planet.z) - planet.radius).toBeCloseTo(8)
  await expect(page.getByRole('progressbar', { name: 'Kadłub', exact: true })).toHaveAttribute('aria-valuenow', '80')
  await expect(page.getByRole('progressbar', { name: 'Osłony', exact: true })).toHaveAttribute('aria-valuenow', '40')
  await expect(page.getByRole('button', { name: 'Zeskanuj i odzyskaj zasoby' })).toBeEnabled()
})

test('local planet scans persist', async ({ page }) => {
  const planet = ORION_PLANETS[0]
  await loadWorld(page, { sectorX: planet.x, sectorY: planet.y, sectorDistance: planet.z - planet.radius - 8, completedMissions: ['glass-orbit'] })
  await page.getByRole('button', { name: 'Zeskanuj i odzyskaj zasoby' }).click()
  await expect(page.getByRole('button', { name: 'Obiekt zbadany' })).toBeDisabled()
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).visitedPlanets, SAVE_KEY)).toContain(planet.id)
})

test('Shift provides half thrust, Space provides full thrust and mouse fires independently', async ({ page }) => {
  test.setTimeout(45000)
  await loadWorld(page, { sectorX: -6000, sectorY: -3000, sectorDistance: 2000 })
  const canvas = page.getByLabel(canvasLabel)
  await expect(page.locator('.world-hangar-beacon')).toHaveCount(1)
  await page.keyboard.down('ShiftLeft')
  await expect(canvas).toHaveAttribute('data-throttle', '0.5')
  await expect.poll(async () => Number(await canvas.getAttribute('data-flight-speed'))).toBeGreaterThan(140)
  expect(Number(await canvas.getAttribute('data-flight-speed'))).toBeLessThan(147)
  await page.keyboard.up('ShiftLeft')
  await page.keyboard.down('Space')
  await expect(canvas).toHaveAttribute('data-throttle', '1')
  await expect.poll(async () => Number(await canvas.getAttribute('data-flight-speed'))).toBeGreaterThan(285)
  expect(await page.evaluate(() => (window as any).__world.meshes.filter((mesh: any) => mesh.name === 'worldPlayerBolt' && mesh.isEnabled()).length)).toBe(0)
  await canvas.dispatchEvent('pointerdown', { button: 0 })
  await expect.poll(() => page.evaluate(() => (window as any).__world.meshes.filter((mesh: any) => mesh.name === 'worldPlayerBolt' && mesh.isEnabled()).length)).toBeGreaterThan(0)
  await canvas.dispatchEvent('pointerup', { button: 0 })
  await page.keyboard.up('Space')
})

test('held Space keeps a stable cruise near stations, enemies and planetary surfaces', async ({ page }) => {
  test.setTimeout(45000)
  await loadWorld(page, { sectorX: -6000, sectorY: -3000, sectorDistance: 2000 })
  const canvas = page.getByLabel(canvasLabel)
  await page.keyboard.down('Space')
  await expect.poll(async () => Number(await canvas.getAttribute('data-flight-speed'))).toBeGreaterThan(292)
  const planet = ORION_PLANETS[0]
  const speeds = await page.evaluate(async sites => {
    const scene = (window as any).__world
    const ship = scene.getTransformNodeByName('playerShip')
    const canvas = scene.getEngine().getRenderingCanvas()
    const samples: number[] = []
    for (const site of sites) {
      ship.position.set(site.x, site.y, site.z)
      ship.rotation.set(0, 0, 0)
      await new Promise<void>(resolve => {
        const start = performance.now()
        const observer = scene.onAfterRenderObservable.add(() => {
          samples.push(Number(canvas.dataset.flightSpeed))
          if (performance.now() - start >= 1400) { scene.onAfterRenderObservable.remove(observer); resolve() }
        })
      })
    }
    return samples
  }, [
    { x: ORION_STATIONS[0].x + 600, y: ORION_STATIONS[0].y, z: ORION_STATIONS[0].launchPosition.z },
    { x: -1200, y: 780, z: 6120 },
    { x: planet.x - planet.radius - 60, y: planet.y, z: planet.z },
  ])
  expect(speeds.length).toBeGreaterThan(10)
  expect(Math.min(...speeds)).toBeGreaterThan(291)
  expect(Math.max(...speeds)).toBeLessThanOrEqual(292.5)
  await page.keyboard.down('ShiftLeft')
  await expect(canvas).toHaveAttribute('data-throttle', '1')
  await page.keyboard.up('Space')
  await expect(canvas).toHaveAttribute('data-throttle', '0.5')
  await expect.poll(async () => Number(await canvas.getAttribute('data-flight-speed'))).toBeLessThan(147)
  expect(Number(await canvas.getAttribute('data-flight-speed'))).toBeGreaterThanOrEqual(146.25)
  await page.keyboard.up('ShiftLeft')
})

test('sun is distant and visible while planets stream within a fixed detail budget', async ({ page }) => {
  await loadWorld(page)
  const result = await page.evaluate(() => {
    const scene = (window as any).__world
    const star = scene.getTransformNodeByName('orionSun')
    return { starZ: star.position.z, sunReady: !!scene.getMeshByName('orionSunCore'), streaming: scene.metadata.planetStreaming,
      fullPlanetCount: scene.meshes.filter((mesh: any) => /^planet-(?!distant)/.test(mesh.name) && !mesh.name.includes('lod')).length }
  })
  expect(result.starZ).toBe(ORION_SUN.z)
  expect(result.starZ).toBeGreaterThan(150000)
  expect(result.sunReady).toBe(true)
  expect(result.streaming.total).toBe(60)
  expect(result.streaming.budget).toBe(2)
  expect(result.streaming.detailed).toBeLessThanOrEqual(2)
  expect(result.fullPlanetCount).toBeLessThanOrEqual(2)
  await expect(page.locator('.world-hangar-beacon')).toHaveCount(1)
})


test('the expanded fleet streams only nearby actors and giant planets load terrain outside their surface', async ({ page }) => {
  await loadWorld(page, { sectorX: -30000, sectorY: -18000, sectorDistance: 1000 })
  const population = await page.evaluate(() => (window as any).__world.metadata.combatStreaming)
  expect(population.totalActors).toBeGreaterThan(3000)
  expect(population.activeActors).toBeLessThanOrEqual(population.activeLimit)
  expect(population.candidates).toBeLessThan(population.totalActors / 10)
  const largest = ORION_PLANETS.reduce((largest, planet) => planet.radius > largest.radius ? planet : largest)
  expect(largest.radius).toBe(37800)
  await page.evaluate(planet => {
    const ship = (window as any).__world.getTransformNodeByName('playerShip')
    ship.position.set(planet.x, planet.y, planet.z - planet.radius - 2000)
  }, largest)
  await expect.poll(() => page.evaluate(id => !!(window as any).__world.getMeshByName(`planet-${id}`)?.material?.diffuseTexture?.isReady(), largest.id)).toBe(true)
  expect(await page.evaluate(() => (window as any).__world.metadata.combatStreaming.activeActors)).toBeLessThanOrEqual(96)
})

test('ambient audio continues through the journal and hangar and respects music volume', async ({ page }) => {
  test.setTimeout(60000)
  await page.addInitScript(() => {
    ;(window as any).__mixes = []
    const connect = AudioNode.prototype.connect
    ;(AudioNode.prototype as any).connect = function (destination: any, ...args: any[]) {
      if (destination === this.context.destination) {
        const analyser = this.context.createAnalyser()
        analyser.fftSize = 2048
        ;(connect as any).call(analyser, destination)
        ;(window as any).__mixes.push({ context: this.context, analyser })
        return (connect as any).call(this, analyser)
      }
      return (connect as any).apply(this, [destination, ...args])
    }
  })
  const station = ORION_STATIONS[0]
  await loadWorld(page, { sectorX: station.launchPosition.x, sectorY: station.launchPosition.y, sectorDistance: station.launchPosition.z })
  const signal = () => page.evaluate(() => {
    const mix = (window as any).__mixes.find((mix: any) => mix.context.state === 'running')
    if (!mix) return 0
    const samples = new Float32Array(mix.analyser.fftSize)
    mix.analyser.getFloatTimeDomainData(samples)
    return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
  })
  await expect.poll(signal).toBeGreaterThan(0.0001)
  await page.keyboard.press('l')
  await expect(page.getByRole('heading', { name: 'Dziennik nawigacyjny' })).toBeVisible()
  await expect.poll(signal).toBeGreaterThan(0.0001)
  await page.keyboard.press('l')
  await page.getByRole('button', { name: 'Wleć do stacji' }).click()
  await expect(page.locator('canvas.garage-world')).toHaveAttribute('data-landing-state', 'landed', { timeout: 30000 })
  await expect.poll(signal).toBeGreaterThan(0.0001)
  await page.getByRole('button', { name: /Opuść hangar|Wyjdź z hangaru/ }).first().click()
  await expect(page.getByLabel(canvasLabel)).toHaveAttribute('data-station-transit', 'idle', { timeout: 20000 })
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'PAUZA' }).getByRole('button', { name: 'Wyjdź' }).click()
  await page.getByRole('button', { name: 'Ustawienia', exact: true }).click()
  await page.locator('#music-volume').focus()
  await page.keyboard.press('Home')
  await expect.poll(signal).toBeLessThan(0.0001)
})

test('solar heat burns the ship, respects resistance and stops after escaping', async ({ page }) => {
  test.setTimeout(45000)
  await loadWorld(page, { sectorX: ORION_SUN.x, sectorY: ORION_SUN.y,
    sectorDistance: ORION_SUN.z - ORION_SUN.radius - 12000,
    shipParts: [{ id: 'heat-engine', slot: 'engine', rarity: 'standard', stats: { damagePercent: 0, shieldPoints: 0, hullPoints: 0, enginePercent: 0 }, resistances: { thermal: 0.5 } }],
    equippedParts: { weapon: null, shield: null, engine: 'heat-engine' },
  })
  const canvas = page.getByLabel(canvasLabel)
  await expect(page.locator('.world-heat-warning')).toContainText('ŻAR GWIAZDY')
  await expect.poll(async () => Number(await canvas.getAttribute('data-burning-intensity'))).toBeGreaterThan(0.3)
  await expect.poll(async () => Number(await page.getByRole('progressbar', { name: 'Osłony', exact: true }).getAttribute('aria-valuenow'))).toBeLessThan(99)
  const burning = await page.evaluate(() => {
    const scene = (window as any).__world
    const flames = scene.particleSystems.find((system: any) => system.name === 'shipBurnFlames')
    return { active: flames.getActiveCount(), capacity: flames.getCapacity() }
  })
  expect(burning.active).toBeGreaterThan(0)
  expect(burning.capacity).toBeLessThanOrEqual(100)
  await page.keyboard.press('i')
  await page.getByRole('dialog', { name: 'Ekwipunek pilota' }).getByText('Odporności statku', { exact: true }).click()
  await expect(page.locator('.resistance-thermal dd')).toHaveText('50%')
  await page.getByRole('button', { name: 'Zamknij ekwipunek' }).click()
  await page.evaluate(() => {
    const ship = (window as any).__world.getTransformNodeByName('playerShip')
    ship.position.set(0, 0, 0)
  })
  await expect.poll(async () => Number(await canvas.getAttribute('data-burning-intensity')), { timeout: 12000 }).toBe(0)
  await expect(page.locator('.world-heat-warning')).toHaveCount(0)
  await expect(page.locator('.world-hangar-beacon')).toHaveCount(1)
})
