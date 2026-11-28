import { gameText, type GameLanguage } from '../i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  GlowLayer,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  HemisphericLight,
  Scene,
  TransformNode,
} from './babylon'
import { GameAudio } from '../audio/GameAudio'
import { applyArmorDamage, PLAYER_WEAPON, resolveWeaponHit } from '../domain/weapon'
import { createDamageNumber, updateDamageNumbers, type FloatingDamageNumber } from './DamageNumber'
import { createImpactEffect } from './ImpactEffect'
import { InputController, type ControlBindings } from '../input/InputController'
import {
  createFlightState,
  integrateShipRoll,
  readFlightUpdate,
} from '../simulation/FlightSimulation'
import { DODGE_TIMING, resolveBossDamage, resolveDamage } from '../domain/combat'
import { getSignalPulseState } from '../domain/signalPulse'
import { ORION_SECTOR_ID } from '../domain/exploration'
import {
  applyMissionReward,
  applyBossEquipmentDrop,
  applyNullChoirReward,
  applySalvageReward,
  applySignalSourceReward,
  loadMissionProgress,
  saveMissionProgress,
  updateSectorPosition,
} from '../progress/missionProgress'
import type { GraphicsQuality } from '../progress/gameSettings'
import {
  SHIP_PART_SLOTS,
  type EquippedPartRarities,
  type ShipPartBonuses,
} from '../progress/shipParts'
import { createShipVisual } from './shipVisual'
import { createRelayVisual, createWardenVisual } from './enemyVisual'
import { createSpaceEnvironment } from './spaceEnvironment'
import { getMission, type MissionId } from '../missions/definitions'
import { ShipStatusHud } from '../ui/ShipStatusHud'
import { createFlightEffects } from './FlightEffects'
import { createStarField } from './combatStarField'
import { createRelayFragments } from './relayFragments'
import { getFragmentTransmission } from './fragmentTransmission'

/** Boss health per mission type; salvage/relay missions have no boss. */
const BOSS_HEALTH = { signal: 360, nullChoir: 360, default: 300 } as const
/** Shield of the signal-relay boss (others start unshielded). */
const BOSS_SHIELD_SIGNAL = 100
/** ArcRotateCamera framing for the combat scene. */
const COMBAT_CAMERA = { alpha: -Math.PI / 2, beta: 1.32, radius: 18 } as const
/** Upper bound on a single frame delta (seconds) to avoid tunnelling after a stall. */
const FRAME_DELTA_CAP = 0.033
/** Flat armor applied to each contact/ram hit. */
const CONTACT_ARMOR = 5
/** Number of bolts in a boss volley per mission type. */
const BOSS_VOLLEY_SPREAD = { relay: 1, nullChoir: 3, default: 2 } as const
/** Delay (ms) before auto-continuing after a mission is won. */
const MISSION_TRANSITION_MS = 2200

interface GameCanvasProps {
  language: GameLanguage
  mission: MissionId
  shieldLevel: number
  shipBonuses: ShipPartBonuses
  equippedPartRarities: EquippedPartRarities
  graphicsQuality: GraphicsQuality
  controls: ControlBindings
  mouseSensitivity: number
  mainVolume: number
  shotsVolume: number
  musicVolume: number
  paused: boolean
  onExperienceChanged: (experience: number) => void
  onMissionContinue: () => void
}

interface Projectile {
  mesh: TransformNode
  velocity: Vector3
  ttl: number
  hostile: boolean
  damage: number
  critical: boolean
  signalAligned?: boolean
}

const GRAPHICS_PROFILE: Record<GraphicsQuality, { hardwareScale: number; glow: number; stars: number }> = {
  low: { hardwareScale: 1.5, glow: 0.3, stars: 90 },
  standard: { hardwareScale: 1, glow: 0.55, stars: 180 },
  high: { hardwareScale: 0.85, glow: 0.8, stars: 260 },
}

export function GameCanvas({
  language,
  mission,
  shieldLevel,
  shipBonuses,
  equippedPartRarities,
  graphicsQuality,
  controls,
  mouseSensitivity,
  mainVolume,
  shotsVolume,
  musicVolume,
  paused,
  onExperienceChanged,
  onMissionContinue,
}: GameCanvasProps) {
  const missionDefinition = getMission(mission)
  const weaponRarity = equippedPartRarities.weapon
  const shieldRarity = equippedPartRarities.shield
  const engineRarity = equippedPartRarities.engine
  const salvageMission = missionDefinition.objective === 'recover-fragments'
  const signalMission = missionDefinition.objective === 'disable-signal'
  const relayMission = salvageMission || signalMission
  const maxBossHealth = salvageMission ? 0 : signalMission ? BOSS_HEALTH.signal : mission === 'null-choir' ? BOSS_HEALTH.nullChoir : BOSS_HEALTH.default
  const maxBossShield = signalMission ? BOSS_SHIELD_SIGNAL : maxBossHealth
  const openingTransmission = salvageMission
    ? gameText(language).combatScene.wreckLogThreeBuoysPreservedFragments
    : signalMission
      ? gameText(language).combatScene.sourceAcquiredTheCoreShieldIs
      : mission === 'null-choir'
        ? gameText(language).combatScene.crewTargetInRangeTheCraft
      : gameText(language).combatScene.theWardensLastSignalRepeatsThe
  const [radioLog, setRadioLog] = useState([openingTransmission])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<InputController | null>(null)
  const audioRef = useRef<GameAudio | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const glowRef = useRef<GlowLayer | null>(null)
  const pausedRef = useRef(paused)
  const wasPausedRef = useRef(paused)
  const liveSettingsRef = useRef({
    controls,
    mouseSensitivity,
    graphicsQuality,
    mainVolume,
    shotsVolume,
    musicVolume,
  })
  const createInitialStatus = useCallback(() => ({
    shield: 100 + shieldLevel * 10 + shipBonuses.shieldPoints,
    hull: 100 + shieldLevel * 5 + shipBonuses.hullPoints,
    boss: maxBossHealth,
    bossShield: salvageMission ? 0 : maxBossShield,
    dodge: 0,
    result: '',
    signalOpen: false,
    pulseRemaining: 0,
  }), [maxBossHealth, maxBossShield, salvageMission, shieldLevel, shipBonuses.hullPoints, shipBonuses.shieldPoints])
  const [status, setStatus] = useState(createInitialStatus)
  const [salvageDistance, setSalvageDistance] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [impactFlash, setImpactFlash] = useState(0)
  const [, setProgress] = useState(loadMissionProgress)
  const rewardGranted = useRef(false)

  useEffect(() => {
    liveSettingsRef.current = {
      controls,
      mouseSensitivity,
      graphicsQuality,
      mainVolume,
      shotsVolume,
      musicVolume,
    }
  }, [controls, graphicsQuality, mainVolume, mouseSensitivity, musicVolume, shotsVolume])

  useEffect(() => {
    const resumed = wasPausedRef.current && !paused
    wasPausedRef.current = paused
    pausedRef.current = paused
    if (resumed && status.hull === 0) {
      rewardGranted.current = false
      setStatus(createInitialStatus())
      setRadioLog([openingTransmission])
      setAttempt((current) => current + 1)
    }
  }, [createInitialStatus, openingTransmission, paused, status.hull])

  useEffect(() => {
    inputRef.current?.updateSettings(controls, mouseSensitivity)
  }, [controls, mouseSensitivity])

  useEffect(() => {
    audioRef.current?.updateLevels({
      main: mainVolume,
      shots: shotsVolume,
      music: musicVolume,
    })
  }, [mainVolume, shotsVolume, musicVolume])

  useEffect(() => {
    if (!engineRef.current || !glowRef.current) return
    const graphics = GRAPHICS_PROFILE[graphicsQuality]
    engineRef.current.setHardwareScalingLevel(graphics.hardwareScale)
    glowRef.current.intensity = graphics.glow
  }, [graphicsQuality])

  useEffect(() => {
    rewardGranted.current = false
    const canvas = canvasRef.current
    if (!canvas) return

    const audio = new GameAudio({
      main: liveSettingsRef.current.mainVolume,
      shots: liveSettingsRef.current.shotsVolume,
      music: liveSettingsRef.current.musicVolume,
    })
    audioRef.current = audio
    const unlockAudio = () => audio.resume()
    window.addEventListener('keydown', unlockAudio, { once: true })
    const graphics = GRAPHICS_PROFILE[liveSettingsRef.current.graphicsQuality]
    const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
    engineRef.current = engine
    engine.setHardwareScalingLevel(graphics.hardwareScale)
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.018, 0.028, 0.042, 1)
    createSpaceEnvironment(scene, liveSettingsRef.current.graphicsQuality)
    const playerShotMaterial = new StandardMaterial('playerShotMaterial', scene)
    playerShotMaterial.emissiveColor = new Color3(1, 0.68, 0.28)
    const hostileShotMaterial = new StandardMaterial('hostileShotMaterial', scene)
    hostileShotMaterial.emissiveColor = new Color3(0.95, 0.22, 0.12)
    const camera = new ArcRotateCamera('camera', COMBAT_CAMERA.alpha, COMBAT_CAMERA.beta, COMBAT_CAMERA.radius, Vector3.Zero(), scene)
    camera.fov = 0.9
    camera.lowerRadiusLimit = 10
    camera.upperRadiusLimit = 22

    const light = new HemisphericLight('light', new Vector3(0.2, 1, -0.3), scene)
    light.intensity = 0.38
    light.groundColor = new Color3(0.07, 0.1, 0.18)
    const glow = new GlowLayer('glow', scene)
    glowRef.current = glow
    glow.intensity = graphics.glow

    const ship = createShipVisual(scene, {
      weapon: weaponRarity,
      shield: shieldRarity,
      engine: engineRarity,
    })
    ship.position.set(0, -2.2, 0)
    const flightEffects = createFlightEffects(
      scene, ship, camera, liveSettingsRef.current.graphicsQuality,
      28 * (1 + shipBonuses.enginePercent / 100) * (1 + (shipBonuses.speedPercent ?? 0) / 100),
    )
    const relayModel = relayMission ? createRelayVisual(scene) : null
    const boss = relayModel?.root ?? createWardenVisual(scene, mission === 'null-choir')
    boss.position.set(0, signalMission ? -1.3 : 1.2, salvageMission ? 25 : mission === 'null-choir' ? 20 : 16)
    const fragments = salvageMission ? createRelayFragments(scene) : []
    const signalClosedColor = new Color3(0.02, 0.21, 0.29)
    const signalOpenColor = new Color3(0.15, 0.85, 1)
    if (signalMission && relayModel) {
      relayModel.coreMaterial.emissiveColor.copyFrom(signalClosedColor)
    }

    const starField = createStarField(scene, graphics.stars)
    const projectiles: Projectile[] = []
    const damageNumbers: FloatingDamageNumber[] = []
    const input = new InputController(
      liveSettingsRef.current.controls,
      canvas,
      liveSettingsRef.current.mouseSensitivity,
    )
    inputRef.current = input
    let flight = createFlightState()
    flight.shield = 100 + shieldLevel * 10 + shipBonuses.shieldPoints
    flight.hull = 100 + shieldLevel * 5 + shipBonuses.hullPoints
    let bossHealth = maxBossHealth
    let bossShield = maxBossShield
    let recoveredFragments = 0
    let bossPhase = 1
    let signalPulseOpen = false
    let shieldDeflectionReported = false
    let bossAttackClock = 0
    let hudClock = 0
    let fireClock = 0
    let elapsed = 0
    let completed = false
    let failed = false

    const currentBossShield = () => {
      if (salvageMission) return 0
      if (signalMission) return signalPulseOpen ? 0 : maxBossShield
      return bossShield
    }

    const applyBossDamage = (amount: number) => {
      if (signalMission) {
        bossHealth = Math.max(0, bossHealth - amount)
      } else {
        const vitals = resolveBossDamage({ health: bossHealth, shield: bossShield, amount })
        bossHealth = vitals.health
        bossShield = vitals.shield
      }
    }

    const disposeProjectile = (projectile: Projectile) => {
      projectile.mesh.dispose()
      const index = projectiles.indexOf(projectile)
      if (index >= 0) projectiles.splice(index, 1)
    }

    const grantMissionReward = () => {
      if (rewardGranted.current) return
      rewardGranted.current = true
      const current = loadMissionProgress()
      const baseReward = mission === 'null-choir'
        ? applyNullChoirReward(current)
        : salvageMission
          ? applySalvageReward(current)
          : signalMission
            ? applySignalSourceReward(current)
            : applyMissionReward(current)
      const reward = salvageMission
        ? baseReward
        : applyBossEquipmentDrop(baseReward, `boss-drop-${mission}-${attempt}-${Date.now()}`)
      const next = updateSectorPosition(
        reward,
        ORION_SECTOR_ID,
        current.sectorDistance,
        current.sectorX,
        current.sectorY,
      )
      saveMissionProgress(next)
      setProgress(next)
      onExperienceChanged(next.experience)
    }

    const firePlayerShot = () => {
      if (fireClock > 0) return
      fireClock = PLAYER_WEAPON.fireCooldown
      audio.playShot()
      const hit = resolveWeaponHit(
        { damagePercent: shipBonuses.damagePercent },
        Math.random,
        flight.perfectBonus > 0,
        weaponRarity ?? 'standard',
      )
      const left = MeshBuilder.CreateCylinder('playerShotL', { height: 0.7, diameter: 0.08 }, scene)
      const right = left.clone('playerShotR')
      left.material = playerShotMaterial
      right.material = playerShotMaterial
      left.rotation.x = Math.PI / 2
      right.rotation.x = Math.PI / 2
      left.position.copyFrom(ship.position).addInPlace(new Vector3(-0.55, 0, 0.4))
      right.position.copyFrom(ship.position).addInPlace(new Vector3(0.55, 0, 0.4))
      projectiles.push(
        {
          mesh: left,
          velocity: new Vector3(0, 0, PLAYER_WEAPON.projectileSpeed),
          ttl: 1.8,
          hostile: false,
          damage: hit.damage,
          critical: hit.critical,
          signalAligned: !signalMission || signalPulseOpen,
        },
        {
          mesh: right,
          velocity: new Vector3(0, 0, PLAYER_WEAPON.projectileSpeed),
          ttl: 1.8,
          hostile: false,
          damage: hit.damage,
          critical: hit.critical,
          signalAligned: !signalMission || signalPulseOpen,
        },
      )
    }

    const fireBossVolley = () => {
      const spread = relayMission ? BOSS_VOLLEY_SPREAD.relay : mission === 'null-choir' ? BOSS_VOLLEY_SPREAD.nullChoir : BOSS_VOLLEY_SPREAD.default
      for (let i = -spread; i <= spread; i += 1) {
        const bolt = MeshBuilder.CreateCylinder(`bossBolt${i}${elapsed}`, { height: 1, diameter: 0.12 }, scene)
        bolt.material = hostileShotMaterial
        bolt.rotation.x = Math.PI / 2
        bolt.position.copyFrom(boss.position)
        const direction = ship.position.subtract(boss.position).normalize()
        direction.x += i * 0.06
        projectiles.push({
          mesh: bolt,
          velocity: direction.scale(9),
          ttl: 5,
          hostile: true,
          damage: 0,
          critical: false,
        })
      }
    }

    scene.onBeforeRenderObservable.add(() => {
      updateDamageNumbers(damageNumbers)
      flightEffects.setPaused(pausedRef.current || completed || failed)
      if (pausedRef.current) return
      const dt = Math.min(engine.getDeltaTime() / 1000, FRAME_DELTA_CAP)
      elapsed += dt
      hudClock += dt
      fireClock = Math.max(0, fireClock - dt)
      if (completed || failed) return
      bossAttackClock += dt
      const signalPulse = signalMission ? getSignalPulseState(elapsed) : null
      if (signalPulse && signalPulse.open !== signalPulseOpen) {
        signalPulseOpen = signalPulse.open
        if (relayModel) {
          relayModel.coreMaterial.emissiveColor.copyFrom(signalPulseOpen ? signalOpenColor : signalClosedColor)
        }
        setRadioLog((current) => [
          ...current.slice(-1),
          signalPulseOpen
            ? gameText(language).combatScene.pulseGapOpenNowFireOn
            : gameText(language).combatScene.shieldClosedAgainHoldFireAnd,
        ])
      }

      const commands = readFlightUpdate((command) => input.isDown(command), input.readMouseFlight())
      const handlingMultiplier = 1 + (shipBonuses.handlingPercent ?? 0) / 100
      const speedMultiplier = 1 + (shipBonuses.speedPercent ?? 0) / 100
      const targetSpeed = commands.thrust > 0
        ? 28 * commands.thrust * (1 + shipBonuses.enginePercent / 100) * speedMultiplier
        : commands.thrust < 0
          ? -18 * (1 + shipBonuses.enginePercent / 100) * speedMultiplier
          : 14 * (1 + shipBonuses.enginePercent / 100) * speedMultiplier
      flight.speed += (targetSpeed - flight.speed) * Math.min(1, dt * 2.2)
      if (salvageMission && !completed) {
        ship.position.z = Math.max(-8, Math.min(26, ship.position.z + flight.speed * dt * 0.15))
      }
      ship.rotation.x += (commands.pitch * 0.18 * handlingMultiplier - ship.rotation.x) * dt * 5
      ship.rotation.y += (commands.yaw * 0.22 * handlingMultiplier - ship.rotation.y) * dt * 5
      ship.rotation.z = integrateShipRoll(ship.rotation.z, commands.roll, dt, handlingMultiplier)
      ship.position.x = Math.max(-8, Math.min(8, ship.position.x + commands.yaw * dt * 7 * handlingMultiplier))
      ship.position.y = Math.max(-5, Math.min(5, ship.position.y - commands.pitch * dt * 5 * handlingMultiplier))
      if (!salvageMission) ship.position.z = 0

      if (commands.dodgeRequested && flight.dodgeCooldown <= 0) {
        flight.activeDodge = true
        flight.dodgeElapsed = 0
        flight.dodgeCooldown = DODGE_TIMING.cooldown
        ship.position.x += commands.yaw === 0 ? 2 : commands.yaw * 2.4
      }
      if (flight.activeDodge) {
        flight.dodgeElapsed += dt
        if (flight.dodgeElapsed >= DODGE_TIMING.startup + DODGE_TIMING.iframes + DODGE_TIMING.recovery) {
          flight.activeDodge = false
          flight.dodgeElapsed = 0
        }
      }
      flight.dodgeCooldown = Math.max(0, flight.dodgeCooldown - dt)
      flight.perfectBonus = Math.max(0, flight.perfectBonus - dt)

      if (commands.fireRequested) firePlayerShot()

      const bossInterval = salvageMission
        ? 3.5
        : signalMission
          ? 3.2
          : mission === 'null-choir'
            ? bossPhase === 1 ? 1.8 : 1.15
            : bossPhase === 1 ? 2.1 : 1.35
      if (bossAttackClock > bossInterval && !completed) {
        bossAttackClock = 0
        fireBossVolley()
      }
      if (!relayMission) {
        boss.rotation.y += dt * (bossPhase === 1 ? 0.16 : 0.28)
        boss.position.x = Math.sin(elapsed * (bossPhase === 1 ? 0.45 : 0.75)) * 4.5
      } else {
        boss.rotation.y += dt * 0.06
        for (const fragment of fragments) fragment.rotation.y += dt * 0.8
      }

      for (const projectile of [...projectiles]) {
        projectile.mesh.position.addInPlace(projectile.velocity.scale(dt))
        projectile.ttl -= dt

        if (projectile.hostile) {
          if (Vector3.Distance(projectile.mesh.position, ship.position) < 0.75) {
            createImpactEffect(scene, ship.position, new Color3(1, 0.2, 0.12), 0.85)
            setImpactFlash((current) => current + 1)
            const previousVitals = flight.shield + flight.hull
            const damage = resolveDamage({
              amount: salvageMission ? 6 : signalMission ? 8 : 16,
              shield: flight.shield,
              dodgeElapsed: flight.dodgeElapsed,
              activeDodge: flight.activeDodge,
            })
            if (damage.perfect) flight.perfectBonus = 2
            flight.shield = Math.max(0, flight.shield - damage.shieldDamage)
            flight.hull = Math.max(0, flight.hull - damage.hullDamage)
            const receivedDamage = previousVitals - flight.shield - flight.hull
            if (receivedDamage > 0) {
              damageNumbers.push(createDamageNumber(scene, ship.position, receivedDamage, false, 'incoming'))
            }
            disposeProjectile(projectile)
          }
        } else if (signalMission && Vector3.Distance(projectile.mesh.position, boss.position) < 2.1) {
          if (signalPulseOpen && projectile.signalAligned) {
            const damage = applyArmorDamage(projectile.damage, CONTACT_ARMOR)
            createImpactEffect(scene, boss.position, new Color3(1, 0.62, 0.25), 1.15)
            setImpactFlash((current) => current + 1)
            damageNumbers.push(createDamageNumber(scene, projectile.mesh.position, damage, projectile.critical))
            applyBossDamage(damage)
            if (bossHealth <= 0) {
              bossHealth = 0
              completed = true
              boss.dispose(false, true)
              setRadioLog((current) => [
                ...current.slice(-1),
                gameText(language).combatScene.theCoreIsSilentItsFinal,
              ])
              grantMissionReward()
            }
          } else if (!shieldDeflectionReported) {
            createImpactEffect(scene, boss.position, new Color3(0.25, 0.72, 1), 0.8)
            setImpactFlash((current) => current + 1)
            shieldDeflectionReported = true
            setRadioLog((current) => [
              ...current.slice(-1),
              signalPulseOpen
                ? gameText(language).combatScene.thatShotWasOutOfSync
                : gameText(language).combatScene.shotsAreBouncingOffTheShield,
            ])
          }
          disposeProjectile(projectile)
        } else if (!relayMission && Vector3.Distance(projectile.mesh.position, boss.position) < 2.1) {
            const damage = applyArmorDamage(projectile.damage, CONTACT_ARMOR)
            createImpactEffect(scene, boss.position, new Color3(1, 0.62, 0.25), 1.15)
            setImpactFlash((current) => current + 1)
            damageNumbers.push(createDamageNumber(scene, projectile.mesh.position, damage, projectile.critical))
            applyBossDamage(damage)
            disposeProjectile(projectile)
            if (bossShield === 0 && bossPhase === 1) {
              bossPhase = 2
              setRadioLog((current) => [
                ...current.slice(-1),
                mission === 'null-choir'
                  ? gameText(language).combatScene.theNullChoirLosesItsShield
                  : gameText(language).combatScene.theAttackPatternJustChangedThe,
              ])
            }
            if (bossHealth <= 0) {
              bossHealth = 0
              completed = true
              boss.dispose(false, true)
              setRadioLog((current) => [
                ...current.slice(-1),
                mission === 'null-choir'
                  ? gameText(language).combatScene.theNullChoirIsSilentMeridian
                  : gameText(language).combatScene.theWardenTransponderWentDarkThe,
              ])
              grantMissionReward()
            }
        } else if (salvageMission) {
          const intercepted = projectiles.find(
            (other) => other.hostile && Vector3.Distance(other.mesh.position, projectile.mesh.position) < 0.45,
          )
          if (intercepted) {
            disposeProjectile(intercepted)
            disposeProjectile(projectile)
          }
        }

        if (projectile.ttl <= 0) disposeProjectile(projectile)
      }

      if (flight.hull <= 0 && !failed && !completed) {
        failed = true
        setRadioLog((current) => [
          ...current.slice(-1),
          gameText(language).combatScene.emergencyTransponderActiveLastCoordinatesRecorded,
        ])
        setProgress((current) => {
          const next = { ...current, lastMission: 'defeat' as const }
          saveMissionProgress(next)
          return next
        })
      }

      if (salvageMission && !completed && !failed) {
        for (const fragment of [...fragments]) {
          if (Vector3.Distance(fragment.position, ship.position) < 2.8) {
            fragment.dispose(false, true)
            fragments.splice(fragments.indexOf(fragment), 1)
            recoveredFragments += 1
            const transmission = getFragmentTransmission(recoveredFragments - 1, language)
            if (transmission) {
              setRadioLog((current) => [...current.slice(-1), transmission])
            }

            if (recoveredFragments === 3) {
              completed = true
              grantMissionReward()
            }
          }
        }
      }

      camera.target.copyFrom(ship.position)
      starField.position.z = (starField.position.z - dt * flight.speed * 0.03) % 50
      flightEffects.update(dt, flight.speed, commands.thrust)

      if (hudClock >= 0.1 || completed || flight.hull <= 0) {
        hudClock = 0
          if (salvageMission) setSalvageDistance(ship.position.z)
          if (completed) {
            setStatus({
              shield: flight.shield,
              hull: flight.hull,
              boss: salvageMission ? recoveredFragments : 0,
              bossShield: currentBossShield(),
              dodge: flight.dodgeCooldown,
              result: salvageMission
                ? (gameText(language).combatScene.dataRecoveredRelayGoesQuiet)
                : signalMission
                  ? (gameText(language).combatScene.coreSilencedMeridianShipyardAcquired)
                  : mission === 'null-choir'
                    ? (gameText(language).combatScene.nullChoirDefeatedShipyardRouteOpen)
                    : (gameText(language).combatScene.victoryMeridianCoreRecovered),
              signalOpen: signalPulse?.open ?? false,
              pulseRemaining: signalPulse?.secondsToChange ?? 0,
          })
          } else if (failed) {
            setStatus({
              shield: 0,
              hull: 0,
              boss: salvageMission ? recoveredFragments : bossHealth,
              bossShield: currentBossShield(),
              dodge: flight.dodgeCooldown,
              result: gameText(language).combatScene.hullLostRetryMission,
              signalOpen: signalPulse?.open ?? false,
              pulseRemaining: signalPulse?.secondsToChange ?? 0,
            })
          } else {
            setStatus({
              shield: flight.shield,
              hull: flight.hull,
              boss: salvageMission ? recoveredFragments : bossHealth,
              bossShield: currentBossShield(),
              dodge: flight.dodgeCooldown,
              result: flight.perfectBonus > 0
                ? (gameText(language).combatScene.perfectDodgeNextHit50)
                : '',
              signalOpen: signalPulse?.open ?? false,
              pulseRemaining: signalPulse?.secondsToChange ?? 0,
            })
          }
        }
    })

    engine.runRenderLoop(() => scene.render())
    const resize = () => engine.resize()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', unlockAudio)
      input.dispose()
      audio.dispose()
      flightEffects.dispose()
      scene.dispose()
      engine.dispose()
      if (inputRef.current === input) inputRef.current = null
      if (audioRef.current === audio) audioRef.current = null
      if (engineRef.current === engine) engineRef.current = null
      if (glowRef.current === glow) glowRef.current = null
    }
  }, [
    language,
    attempt,
    shieldLevel,
    shipBonuses.damagePercent,
    shipBonuses.enginePercent,
    shipBonuses.handlingPercent,
    shipBonuses.hullPoints,
    shipBonuses.speedPercent,
    shipBonuses.shieldPoints,
    mission,
    salvageMission,
    signalMission,
    relayMission,
    onExperienceChanged,
    maxBossHealth,
    maxBossShield,
    weaponRarity,
    shieldRarity,
    engineRarity,
  ])

  const panel = gameText(language).combatScene.panel
  const copy = {
    ...panel,
    boss: salvageMission ? panel.recoveredBoss : missionDefinition.title[language],
    briefing: missionDefinition.briefing[language],
  }

  const missionWon = salvageMission ? status.boss >= 3 : status.boss === 0

  useEffect(() => {
    if (!missionWon || paused) return
    const transition = window.setTimeout(onMissionContinue, MISSION_TRANSITION_MS)
    return () => window.clearTimeout(transition)
  }, [missionWon, onMissionContinue, paused])

  return (
    <main className="game-shell">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label={gameText(language).combatScene.view}
        data-equipped-parts={SHIP_PART_SLOTS.filter((slot) => equippedPartRarities[slot]).join(',')}
        data-flight-distance={salvageMission ? salvageDistance.toFixed(2) : undefined}
      />
      {impactFlash > 0 && <div key={impactFlash} className="impact-flash" aria-hidden="true" />}
      <header className="game-hud">
        {salvageMission ? (
          <div className="target-name">
            {copy.boss}
            <span>{Math.floor(status.boss)}/3</span>
          </div>
        ) : (
          <section className="boss-vitals" aria-label={gameText(language).combatScene.bossStatus}>
            <div className="boss-meter boss-meter-health" role="progressbar"
              aria-label={gameText(language).combatScene.bossHealth}
              aria-valuemin={0} aria-valuemax={maxBossHealth} aria-valuenow={Math.ceil(status.boss)}>
              <div className="boss-meter-label">
                <span>{gameText(language).combatScene.health}</span>
                <b>{Math.ceil(status.boss)} / {maxBossHealth}</b>
              </div>
              <div className="boss-meter-track">
                <span style={{ width: `${Math.max(0, Math.min(100, status.boss / maxBossHealth * 100))}%` }} />
              </div>
            </div>
            <div className="boss-meter boss-meter-shield" role="progressbar"
              aria-label={gameText(language).combatScene.bossShield}
              aria-valuemin={0} aria-valuemax={maxBossShield} aria-valuenow={Math.ceil(status.bossShield)}>
              <div className="boss-meter-label">
                <span>{gameText(language).combatScene.shield}</span>
                <b>{Math.ceil(status.bossShield)} / {maxBossShield}</b>
              </div>
              <div className="boss-meter-track">
                <span style={{ width: `${maxBossShield ? Math.max(0, Math.min(100, status.bossShield / maxBossShield * 100)) : 0}%` }} />
              </div>
            </div>
            {signalMission && (
              <b className={`signal-window ${status.signalOpen ? 'open' : 'closed'}`}>
                {status.signalOpen ? copy.signalOpen : copy.signalClosed}
                {' • '}{status.pulseRemaining.toFixed(1)}s
              </b>
            )}
          </section>
        )}
      </header>
      <ShipStatusHud
        language={language}
        shield={status.shield}
        maxShield={100 + shieldLevel * 10 + shipBonuses.shieldPoints}
        hull={status.hull}
        maxHull={100 + shieldLevel * 5 + shipBonuses.hullPoints}
        dodgeRemaining={status.dodge}
        dodgeDuration={DODGE_TIMING.cooldown}
      />
      {status.result && <div className="combat-result" role="status">{status.result}</div>}
      <aside className="radio-log" aria-label={copy.radio} role="log" aria-live="polite" aria-relevant="additions text">
        <p className="radio-label">{copy.radio}</p>
        {radioLog.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
      </aside>
    </main>
  )
}
