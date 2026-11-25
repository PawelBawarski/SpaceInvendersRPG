import { useEffect, useRef } from 'react'
import { GameAudio, type GameAudioLevels } from './GameAudio'

export function useApplicationAudio(screen: string, levels: GameAudioLevels) {
  const { main, shots, music } = levels
  const audioRef = useRef<GameAudio | null>(null)
  const latest = useRef({ screen, levels })
  useEffect(() => { latest.current = { screen, levels: { main, shots, music } } }, [screen, main, shots, music])
  useEffect(() => {
    const audio = new GameAudio(latest.current.levels, { engine: false })
    audioRef.current = audio
    let lastHover = 0
    const unlock = (event: Event) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null
      void audio.resume().then(() => {
        if (event.type === 'pointerdown' && button) audio.playUiSound(button.classList.contains('journal-close') ? 'close' : 'confirm')
        if (event instanceof KeyboardEvent && !event.repeat && ['KeyL', 'KeyC', 'KeyI', 'Escape'].includes(event.code)) audio.playUiSound(latest.current.screen === 'campaign' || event.code === 'Escape' ? 'close' : 'open')
      })
    }
    const hover = (event: PointerEvent) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null
      if (!button || (event.relatedTarget instanceof Node && button.contains(event.relatedTarget)) || performance.now() - lastHover < 180) return
      lastHover = performance.now()
      audio.playUiSound('hover')
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    window.addEventListener('pointerover', hover)
    return () => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
      window.removeEventListener('pointerover', hover)
      audio.dispose()
      audioRef.current = null
    }
  }, [])
  useEffect(() => { audioRef.current?.updateLevels({ main, shots, music }) }, [main, shots, music])
  useEffect(() => {
    audioRef.current?.setAmbience(screen === 'campaign' ? 'journal' : screen === 'garage' || screen === 'prologue' ? 'hangar' : screen === 'exploration' ? 'flight' : 'title')
  }, [screen])
  return audioRef
}
