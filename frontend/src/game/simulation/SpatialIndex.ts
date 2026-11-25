import type { SectorPosition } from '../domain/exploration'

/** Sparse moving-object grid: distant fleets never enter the per-frame combat loop. */
export class SpatialIndex<T> {
  private readonly cells = new Map<string, Set<T>>()
  private readonly membership = new Map<T, string>()
  private readonly cellSize: number
  private readonly positionOf: (item: T) => SectorPosition
  constructor(cellSize: number, positionOf: (item: T) => SectorPosition) { this.cellSize = cellSize; this.positionOf = positionOf }

  update(item: T) {
    const point = this.positionOf(item)
    const key = `${Math.floor(point.x / this.cellSize)},${Math.floor(point.y / this.cellSize)},${Math.floor(point.z / this.cellSize)}`
    if (this.membership.get(item) === key) return
    this.remove(item)
    let cell = this.cells.get(key)
    if (!cell) { cell = new Set(); this.cells.set(key, cell) }
    cell.add(item)
    this.membership.set(item, key)
  }

  remove(item: T) {
    const key = this.membership.get(item)
    if (key === undefined) return
    const cell = this.cells.get(key)!
    cell.delete(item)
    if (cell.size === 0) this.cells.delete(key)
    this.membership.delete(item)
  }

  query(point: SectorPosition, radius: number): T[] {
    const result: T[] = []
    for (let x = Math.floor((point.x - radius) / this.cellSize); x <= Math.floor((point.x + radius) / this.cellSize); x++) {
      for (let y = Math.floor((point.y - radius) / this.cellSize); y <= Math.floor((point.y + radius) / this.cellSize); y++) {
        for (let z = Math.floor((point.z - radius) / this.cellSize); z <= Math.floor((point.z + radius) / this.cellSize); z++) {
          for (const item of this.cells.get(`${x},${y},${z}`) ?? []) {
            const p = this.positionOf(item)
            if ((p.x - point.x) ** 2 + (p.y - point.y) ** 2 + (p.z - point.z) ** 2 <= radius * radius) result.push(item)
          }
        }
      }
    }
    return result
  }
}
