// Mapeo PURO filas de Supabase -> tipos de la app. Sin dependencias de red,
// para poder probarlo aislado aunque @supabase/supabase-js no esté instalado.
import type { LatLng, SpotFeature, SpotStatus } from '../components/Map'
import { normalizeStatus, type Lot } from './lots'

type Ring = number[][]

/** Cierra un anillo [lng,lat] si viene abierto (último != primero). */
export function closeRing(ring: Ring): Ring {
  if (ring.length < 3) return ring
  const [fx, fy] = ring[0]
  const [lx, ly] = ring[ring.length - 1]
  return fx === lx && fy === ly ? ring : [...ring, [fx, fy]]
}

/** Fila de `space` con su join opcional `space_state`. */
export interface SpaceRow {
  id: number
  code?: string
  map_polygon: Ring
  angle?: number | null
  // space_state puede venir como objeto, arreglo (join 1:1 de PostgREST) o null.
  space_state?: { status?: string; confidence?: number; updated_at?: string } | Array<{ status?: string; updated_at?: string }> | null
}

function stateOf(row: SpaceRow) {
  const s = row.space_state
  return Array.isArray(s) ? s[0] : s
}

/** `space` -> `SpotFeature`. Sin estado -> `no_data`. Polígono abierto se cierra. */
export function spaceToSpot(row: SpaceRow): SpotFeature {
  const st = stateOf(row)
  const status: SpotStatus = st ? normalizeStatus(st.status) : 'no_data'
  return {
    type: 'Feature',
    id: row.id,
    properties: { id: row.id, batch: 0, status },
    geometry: { type: 'Polygon', coordinates: [closeRing(row.map_polygon)] },
  }
}

/** updated_at (ISO) del estado, o null. Para "En vivo · hace N s" y latencia. */
export function spaceUpdatedAt(row: SpaceRow): number | null {
  const st = stateOf(row)
  return st?.updated_at ? Date.parse(st.updated_at) : null
}

/** Fila de `parking_lot`. boundary/lanes son jsonb de [lng,lat]. */
export interface LotRow {
  id: number | string
  name: string
  address?: string
  boundary?: Ring | null
  lanes?: Ring[] | null
}

/** `parking_lot` (+ puestos ya mapeados) -> `Lot` de la app. */
export function lotFromRow(row: LotRow, spots: SpotFeature[] = []): Lot {
  return {
    id: String(row.id),
    name: row.name,
    spots,
    zone: (row.boundary as LatLng[]) ?? undefined,
    lanes: (row.lanes as LatLng[][]) ?? undefined,
  }
}
