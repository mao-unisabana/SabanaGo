import { countsOf, migrateSpots } from './lots'
import type { SpotFeature, SpotStatus } from '../components/Map'

const spot = (id: number, status: SpotStatus): SpotFeature => ({
  type: 'Feature',
  id,
  properties: { id, batch: 0, status },
  geometry: { type: 'Polygon', coordinates: [[]] },
})

describe('countsOf', () => {
  it('cuenta libres, ocupados, sin datos y total (5/6/1/12)', () => {
    const statuses: SpotStatus[] = [
      ...Array(5).fill('free'),
      ...Array(6).fill('occupied'),
      'no_data',
    ]
    const spots = statuses.map((s, i) => spot(i + 1, s))
    expect(countsOf(spots)).toEqual({ free: 5, occupied: 6, noData: 1, total: 12 })
  })
})

describe('migrateSpots', () => {
  it('migra busy a occupied y state a status', () => {
    const old = [{ id: 1, properties: { id: 1, batch: 0, state: 'busy' } }, { id: 2, properties: { id: 2, batch: 0, state: 'free' } }]
    const out = migrateSpots(old)
    expect(out.map((s) => s.properties.status)).toEqual(['occupied', 'free'])
    expect('state' in out[0].properties).toBe(false)
  })

  it('trata estados desconocidos o ausentes como no_data, nunca libre', () => {
    const out = migrateSpots([{ properties: { status: 'x' } }, { properties: {} }, {}])
    expect(out.map((s) => s.properties.status)).toEqual(['no_data', 'no_data', 'no_data'])
  })
})
