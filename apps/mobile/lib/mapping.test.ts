import { closeRing, spaceToSpot, lotFromRow } from './mapping'

// Fila de ejemplo con el anillo ABIERTO (4 vértices, el 1º no se repite).
const openRing = [[-74, 4.6], [-74.001, 4.6], [-74.001, 4.601], [-74, 4.601]]

test('cierra el polígono abierto', () => {
  const closed = closeRing(openRing)
  expect(closed.length).toBe(openRing.length + 1)
  expect(closed[closed.length - 1]).toEqual(closed[0])
})

test('no re-cierra un anillo ya cerrado', () => {
  const closed = closeRing([...openRing, openRing[0]])
  expect(closed.length).toBe(openRing.length + 1)
})

test('status desde space_state (objeto y arreglo); sin estado -> no_data', () => {
  expect(spaceToSpot({ id: 1, map_polygon: openRing, space_state: { status: 'occupied' } }).properties.status).toBe('occupied')
  expect(spaceToSpot({ id: 2, map_polygon: openRing, space_state: [{ status: 'free' }] }).properties.status).toBe('free')
  expect(spaceToSpot({ id: 3, map_polygon: openRing, space_state: null }).properties.status).toBe('no_data')
  // 'busy' (formato viejo) -> occupied vía normalizeStatus
  expect(spaceToSpot({ id: 4, map_polygon: openRing, space_state: { status: 'busy' } }).properties.status).toBe('occupied')
})

test('spaceToSpot deja el anillo cerrado en geometry', () => {
  const spot = spaceToSpot({ id: 1, map_polygon: openRing, space_state: null })
  const ring = spot.geometry.coordinates[0]
  expect(ring[ring.length - 1]).toEqual(ring[0])
})

test('lotFromRow mapea id a string y boundary a zone', () => {
  const lot = lotFromRow({ id: 7, name: 'Alejandría', boundary: openRing as any }, [])
  expect(lot.id).toBe('7')
  expect(lot.name).toBe('Alejandría')
  expect(lot.zone).toEqual(openRing)
})
