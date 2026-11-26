import { gameText, type GameLanguage } from '../i18n'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { GalaxyWorld, SectorPosition } from '../domain/exploration'

const WIDTH = 400
const DEFAULT_HEIGHT = 248
const MAX_ZOOM = 8
const WHOLE_SECTOR = { zoom: 1, x: 0, y: 0 }
type ChartView = typeof WHOLE_SECTOR
type ChartPoint = { x: number; y: number }

function project({ x, z }: SectorPosition, height: number, bounds: GalaxyWorld['bounds']): ChartPoint {
  return {
    x: 20 + (x - bounds.minX) / (bounds.maxX - bounds.minX) * (WIDTH - 40),
    y: height - 16 - (z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (height - 32),
  }
}

function boundView(view: ChartView, height: number): ChartView {
  return {
    ...view,
    x: Math.min(0, Math.max(WIDTH * (1 - view.zoom), view.x)),
    y: Math.min(0, Math.max(height * (1 - view.zoom), view.y)),
  }
}

function zoomAt(view: ChartView, factor: number, point: ChartPoint, height: number): ChartView {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom * factor))
  const ratio = zoom / view.zoom
  return boundView({ zoom, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio }, height)
}

export function SectorChart({ world, position, target, language }: {
  world: GalaxyWorld
  position: SectorPosition
  target: SectorPosition | null | undefined
  language: GameLanguage
}) {
  const [view, setView] = useState(WHOLE_SECTOR)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [dragging, setDragging] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const heightRef = useRef(DEFAULT_HEIGHT)
  const dragRef = useRef<{ id: number; last: ChartPoint } | null>(null)
  const svgPoint = (svg: SVGSVGElement, x: number, y: number) => {
    const matrix = svg.getScreenCTM()
    return matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : { x, y }
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (!event.deltaY) return
      const point = svgPoint(svg, event.clientX, event.clientY)
      const factor = event.deltaY < 0 ? 1.28 : 1 / 1.28
      setView(current => zoomAt(current, factor, point, heightRef.current))
    }
    svg.addEventListener('wheel', wheel, { passive: false })
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width <= 0 || height <= 0) return
      const next = Math.max(110, Math.min(760, Math.round(height / width * WIDTH)))
      const before = heightRef.current
      if (next === before) return
      heightRef.current = next
      setHeight(next)
      setView(current => boundView({ ...current, y: current.y * next / before }, next))
    })
    resize.observe(svg)
    return () => { resize.disconnect(); svg.removeEventListener('wheel', wheel) }
  }, [])

  const zoomFromCenter = (factor: number) => setView(current => zoomAt(current, factor, { x: WIDTH / 2, y: height / 2 }, height))
  const startDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || view.zoom === 1 || dragRef.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { id: event.pointerId, last: svgPoint(event.currentTarget, event.clientX, event.clientY) }
    setDragging(true)
  }
  const drag = (event: PointerEvent<SVGSVGElement>) => {
    const current = dragRef.current
    if (current?.id !== event.pointerId) return
    const point = svgPoint(event.currentTarget, event.clientX, event.clientY)
    const dx = point.x - current.last.x
    const dy = point.y - current.last.y
    current.last = point
    setView(previous => boundView({ ...previous, x: previous.x + dx, y: previous.y + dy }, height))
  }
  const stopDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.id !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
  }
  const useKeyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    const shifts: Record<string, ChartPoint> = {
      ArrowLeft: { x: 36, y: 0 }, ArrowRight: { x: -36, y: 0 }, ArrowUp: { x: 0, y: 36 }, ArrowDown: { x: 0, y: -36 },
    }
    const shift = shifts[event.key]
    if (shift) setView(current => boundView({ ...current, x: current.x + shift.x, y: current.y + shift.y }, height))
    else if (event.key === '+' || event.key === '=') zoomFromCenter(1.45)
    else if (event.key === '-') zoomFromCenter(1 / 1.45)
    else if (event.key === '0') setView(WHOLE_SECTOR)
    else return
    event.preventDefault()
  }

  const pilot = project(position, height, world.bounds)
  const destination = target ? project(target, height, world.bounds) : null
  const sun = project(world.sun, height, world.bounds)
  const merchant = project(world.merchant, height, world.bounds)
  const radius = 1 / view.zoom

  return <div className="journal-star-chart">
    <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${height}`} className={dragging ? 'is-dragging' : undefined} tabIndex={0}
      role="group" aria-label={gameText(language).chart.interactiveSectorMap}
      onPointerDown={startDrag} onPointerMove={drag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}
      onKeyDown={useKeyboard}>
      <defs>
        <pattern id="sector-chart-grid" width="32" height="24" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V24" fill="none" className="chart-grid"/>
        </pattern>
        <radialGradient id="sector-chart-glow">
          <stop stopColor="#337da0" stopOpacity=".26"/><stop offset="1" stopColor="#10203b" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width={WIDTH} height={height} fill="url(#sector-chart-glow)"/>
      <g data-map-content="" transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
        <rect width={WIDTH} height={height} fill="url(#sector-chart-grid)"/>
        {[.18, .34, .48].map(r => <circle key={r} cx={WIDTH / 2} cy={height / 2} r={r * Math.min(WIDTH, height)} className="chart-orbit"/>)}
        {destination && <path d={`M${pilot.x} ${pilot.y}L${destination.x} ${destination.y}`} className="chart-course"/>}
        {world.planets.map(planet => {
          const point = project(planet, height, world.bounds)
          const size = Math.min(4.4, 2.2 + Math.sqrt(planet.radius) / 60)
          return <g key={planet.id}>
            <circle cx={point.x} cy={point.y} r={size * radius} fill={planet.color} className="chart-planet">
              <title>{planet.name[language]}</title>
            </circle>
            {view.zoom >= 4 && <text x={point.x + 7 * radius} y={point.y + 4 * radius} style={{ fontSize: 14 * radius }}>{planet.name[language]}</text>}
          </g>
        })}
        <circle cx={sun.x} cy={sun.y} r={11 * radius} fill={world.galaxy.sunColor} opacity=".18"/>
        <circle cx={sun.x} cy={sun.y} r={5 * radius} fill={world.galaxy.sunColor}><title>{world.sun.name[language]}</title></circle>
        <path d="M0 -4L4 0L0 4L-4 0Z" transform={`translate(${merchant.x} ${merchant.y}) scale(${radius})`} fill="#efc17e">
          <title>{world.merchant.name[language]}</title>
        </path>
        {destination && <circle cx={destination.x} cy={destination.y} r={7 * radius} className="chart-target"/>}
        <path d="M0 -6L-4 5L0 3L4 5Z" transform={`translate(${pilot.x} ${pilot.y}) scale(${radius})`} className="chart-pilot">
          <title>{gameText(language).chart.yourShip}</title>
        </path>
      </g>
    </svg>
    <div className="journal-chart-tools">
      <button type="button" onClick={() => zoomFromCenter(1 / 1.45)} disabled={view.zoom === 1} aria-label={gameText(language).chart.zoomOut} data-tooltip={gameText(language).chart.zoomOut}>−</button>
      <button type="button" onClick={() => setView(WHOLE_SECTOR)} disabled={view.zoom === 1} aria-label={gameText(language).chart.resetMapView} data-tooltip={gameText(language).chart.resetMapView}>{Number(view.zoom.toFixed(1))}×</button>
      <button type="button" onClick={() => zoomFromCenter(1.45)} disabled={view.zoom === MAX_ZOOM} aria-label={gameText(language).chart.zoomIn} data-tooltip={gameText(language).chart.zoomIn}>+</button>
    </div>
  </div>
}
