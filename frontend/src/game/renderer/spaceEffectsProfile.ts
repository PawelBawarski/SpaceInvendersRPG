import type { GraphicsQuality, GraphicsSettings } from '../progress/gameSettings'

export function getHardwareScaling(graphics: GraphicsSettings) {
  return graphics.renderScale === null
    ? graphics.graphicsQuality === 'low' ? 1.5 : graphics.graphicsQuality === 'high' ? 0.85 : 1
    : 1 / graphics.renderScale
}

export function spaceEffectsProfile(quality: GraphicsQuality) {
  return {
    glowIntensity: quality === 'high' ? 0.3 : quality === 'low' ? 0.1 : 0.18,
    glowRatio: quality === 'high' ? 0.25 : 0.125,
    glowKernel: 8,
    planetBudget: quality === 'high' ? 3 : quality === 'low' ? 1 : 2,
    trailCapacity: quality === 'high' ? 64 : quality === 'low' ? 24 : 40,
    trailRate: quality === 'low' ? 26 : quality === 'high' ? 76 : 52,
    streakCount: quality === 'high' ? 26 : quality === 'low' ? 8 : 16,
  }
}
