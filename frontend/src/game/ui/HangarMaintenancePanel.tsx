import { formatText, gameText, type GameLanguage } from '../i18n'
import type { MissionProgress } from '../progress/missionProgress'
import { getShieldRechargeCost, getShipVitals, HANGAR_HULL_REGEN_PER_SECOND } from '../progress/shipMaintenance'
import '../../styles/ui/HangarMaintenancePanel.scss'

export function HangarMaintenancePanel({ progress, language, onRecharge }: { progress: MissionProgress; language: GameLanguage; onRecharge: () => void }) {
  const cost = getShieldRechargeCost(progress)
  const vitals = getShipVitals(progress)
  return <section className="hangar-maintenance" aria-label={gameText(language).maintenance.shipMaintenance}>
    <strong>{gameText(language).maintenance.shipMaintenance2}</strong>
    <p>{formatText(gameText(language).maintenance.hullRepairRate, { rate: HANGAR_HULL_REGEN_PER_SECOND })}</p>
    {progress.initialRepairRequired && <p role="status">{gameText(language).maintenance.initialRepairLock}</p>}
    <span>{gameText(language).maintenance.shields}: {Math.ceil(vitals.shield)}</span>
    <button type="button" onClick={onRecharge} disabled={cost === 0 || progress.credits < cost}>
      {cost === 0 ? (gameText(language).maintenance.shieldsFullyCharged) : `${gameText(language).maintenance.rechargeShields} · ${cost} KS`}
    </button>
    {progress.credits < cost && <small>{gameText(language).maintenance.need} {Math.ceil(cost - progress.credits)} KS</small>}
  </section>
}
