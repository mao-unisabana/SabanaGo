import type { Occupancy } from './api'

export type LotFilter = 'all' | 'free' | 'favorites'
export type LotState = 'free' | 'full' | 'no_data'

export interface PickerItem {
  id: string
  name: string
  zones: number | null // null mientras no se conoce
  occ: Occupancy | null
  favorite: boolean
}

/** Minúsculas y sin diacríticos, para buscar "cafeteria" y hallar "Cafetería". */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Sin datos si el lote no tiene puestos o todos están en no_data. */
export function lotState(occ: Occupancy | null): LotState {
  if (!occ || occ.total === 0 || occ.no_data >= occ.total) return 'no_data'
  return occ.free > 0 ? 'free' : 'full'
}

export function filterLots(items: PickerItem[], query: string, filter: LotFilter): PickerItem[] {
  const q = normalizeText(query)
  return items.filter((it) => {
    if (q && !normalizeText(it.name).includes(q)) return false
    if (filter === 'free') return it.occ !== null && it.occ.free > 0
    if (filter === 'favorites') return it.favorite
    return true
  })
}
