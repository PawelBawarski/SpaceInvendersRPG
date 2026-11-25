import type { MissionProgress } from '../progress/missionProgress'
import { getShieldRechargeCost, getShipVitals } from '../progress/shipMaintenance'
import './HangarMaintenancePanel.css'

export function HangarMaintenancePanel({ progress, language, onRecharge }: { progress: MissionProgress; language: 'pl' | 'en'; onRecharge: () => void }) {
  const pl = language === 'pl'
  const cost = getShieldRechargeCost(progress)
  const vitals = getShipVitals(progress)
  return <section className="hangar-maintenance" aria-label={pl ? 'Serwis statku' : 'Ship maintenance'}>
    <strong>{pl ? 'SERWIS STATKU' : 'SHIP MAINTENANCE'}</strong>
    <p>{pl ? 'Kadłub regeneruje się bezpłatnie: 10 HP/s.' : 'Hull repairs automatically: 10 HP/s, free.'}</p>
    <span>{pl ? 'Osłony' : 'Shields'}: {Math.ceil(vitals.shield)}</span>
    <button type="button" onClick={onRecharge} disabled={cost === 0 || progress.credits < cost}>
      {cost === 0 ? (pl ? 'Osłony naładowane' : 'Shields fully charged') : `${pl ? 'Naładuj osłony' : 'Recharge shields'} · ${cost} KS`}
    </button>
    {progress.credits < cost && <small>{pl ? 'Brakuje' : 'Need'} {Math.ceil(cost - progress.credits)} KS</small>}
  </section>
}
