import { gameText, type GameLanguage } from '../i18n'
import { availableSkillPoints, canLearnPilotSkill, PILOT_SKILLS, type PilotSkillId } from '../progress/pilotSkills'

export function PilotTraining({ level, learned, language, onLearn }: {
  level: number; learned: readonly PilotSkillId[]; language: GameLanguage; onLearn: (id: PilotSkillId) => void
}) {
  const tracks = [['flight', gameText(language).training.flight], ['combat', gameText(language).training.combat], ['systems', gameText(language).training.systems]] as const
  const points = availableSkillPoints(level, learned)
  return <section className="pilot-training" aria-label={gameText(language).training.pilotSkills}>
    <div className="pilot-training-lead">
      <h3>{gameText(language).training.pilotSkills}</h3>
      <strong>{gameText(language).training.availablePoints} · {points}</strong>
    </div>
    <p>{gameText(language).training.earnOneSkillPointPerLevel}</p>
    <div className="pilot-training-tracks">
      {tracks.map(([track, label]) => <section key={track} className="pilot-training-track">
        <h4>{label}</h4>
        {PILOT_SKILLS.filter(skill => skill.track === track).map(skill => {
          const acquired = learned.includes(skill.id)
          const prerequisite = PILOT_SKILLS.find(entry => entry.id === skill.requires)
          return <article key={skill.id} className={acquired ? 'skill-acquired' : undefined}>
            <span>{gameText(language).training.level} {skill.level}</span>
            <strong>{skill.name[language]}</strong>
            <p>{skill.detail[language]}</p>
            {prerequisite && <small>{gameText(language).training.requires} · {prerequisite.name[language]}</small>}
            <button type="button" disabled={!canLearnPilotSkill(skill, level, learned)} onClick={() => onLearn(skill.id)}
              aria-label={`${gameText(language).training.unlock} ${skill.name[language]}`}>
              {acquired ? (gameText(language).training.learned) : (gameText(language).training.unlock1Point)}
            </button>
          </article>
        })}
      </section>)}
    </div>
  </section>
}
