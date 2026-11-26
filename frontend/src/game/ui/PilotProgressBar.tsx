import { gameText, type GameLanguage } from '../i18n'
import { getPilotExperienceProgress } from '../progress/missionProgress'

interface PilotProgressBarProps {
  experience: number
  language: GameLanguage
}

export function PilotProgressBar({ experience, language }: PilotProgressBarProps) {
  const progress = getPilotExperienceProgress(experience)
  const percent = progress.experienceIntoLevel / progress.experienceToNextLevel * 100
  const title = gameText(language).pilotProgress.pilotProgress

  return (
    <aside className="pilot-progress" aria-label={title}>
      <strong className="pilot-progress-level">
        {gameText(language).pilotProgress.lv} {progress.level}
      </strong>
      <div
        className="pilot-progress-track"
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={progress.experienceToNextLevel}
        aria-valuenow={progress.experienceIntoLevel}
      >
        <span className="pilot-progress-fill" style={{ width: `${percent}%` }} />
        {Array.from({ length: 4 }, (_, index) => (
          <i className="pilot-progress-divider" key={index} aria-hidden="true" />
        ))}
      </div>
      <span className="pilot-progress-count">
        {progress.experienceIntoLevel} / {progress.experienceToNextLevel} XP
      </span>
    </aside>
  )
}
