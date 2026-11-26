import '../../styles/ui/GameLoadingScreen.scss'

export function GameLoadingScreen({ label }: { label: string }) {
  return <div className="game-loading" role="status" aria-live="polite">
    <span className="game-loading-sigil" aria-hidden="true" />
    <span>{label}</span>
    <span className="game-loading-track" aria-hidden="true"><i /></span>
  </div>
}
