import { availableSkillPoints, canLearnPilotSkill, PILOT_SKILLS, type PilotSkillId } from '../progress/pilotSkills'

export function PilotTraining({ level, learned, language, onLearn }: {
  level: number; learned: readonly PilotSkillId[]; language: 'pl' | 'en'; onLearn: (id: PilotSkillId) => void
}) {
  const pl = language === 'pl'
  const tracks = [['flight', pl ? 'Pilotaż' : 'Flight'], ['combat', pl ? 'Walka' : 'Combat'], ['systems', pl ? 'Systemy' : 'Systems']] as const
  const points = availableSkillPoints(level, learned)
  return <section className="pilot-training" aria-label={pl ? 'Umiejętności pilota' : 'Pilot skills'}>
    <div className="pilot-training-lead">
      <h3>{pl ? 'Umiejętności pilota' : 'Pilot skills'}</h3>
      <strong>{pl ? 'Wolne punkty' : 'Available points'} · {points}</strong>
    </div>
    <p>{pl ? 'Od poziomu 2 dostajesz punkt rozwoju za każdy poziom.' : 'Earn one skill point per level, starting at level 2.'}</p>
    <div className="pilot-training-tracks">
      {tracks.map(([track, label]) => <section key={track} className="pilot-training-track">
        <h4>{label}</h4>
        {PILOT_SKILLS.filter(skill => skill.track === track).map(skill => {
          const acquired = learned.includes(skill.id)
          const prerequisite = PILOT_SKILLS.find(entry => entry.id === skill.requires)
          return <article key={skill.id} className={acquired ? 'skill-acquired' : undefined}>
            <span>{pl ? 'POZIOM' : 'LEVEL'} {skill.level}</span>
            <strong>{skill.name[language]}</strong>
            <p>{skill.detail[language]}</p>
            {prerequisite && <small>{pl ? 'Wymaga' : 'Requires'} · {prerequisite.name[language]}</small>}
            <button type="button" disabled={!canLearnPilotSkill(skill, level, learned)} onClick={() => onLearn(skill.id)}
              aria-label={`${pl ? 'Odblokuj' : 'Unlock'} ${skill.name[language]}`}>
              {acquired ? (pl ? 'Opanowana' : 'Learned') : (pl ? 'Odblokuj · 1 pkt' : 'Unlock · 1 point')}
            </button>
          </article>
        })}
      </section>)}
    </div>
  </section>
}
