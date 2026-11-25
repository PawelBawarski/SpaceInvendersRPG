import type { GraphicsQuality } from '../progress/gameSettings'

export function spaceEffectsProfile(quality: GraphicsQuality) {
  return {
    glowIntensity: quality === 'high' ? 0.3 : quality === 'low' ? 0.1 : 0.18,
    glowRatio: quality === 'high' ? 0.25 : 0.125,
    glowKernel: 8,
    planetBudget: quality === 'high' ? 3 : quality === 'low' ? 1 : 2,
    trailCapacity: quality === 'high' ? 64 : quality === 'low' ? 24 : 40,
    trailRate: quality === 'low' ? 18 : 30,
    streakCount: quality === 'high' ? 12 : quality === 'low' ? 5 : 8,
  }
}
