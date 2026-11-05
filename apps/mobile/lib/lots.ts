import type { Counts, LatLng, SpotFeature } from '../components/Map'

export interface Lot {
  id: string
  name: string
  spots: SpotFeature[]
  /** Contorno del parqueadero: anillo abierto de [lng, lat] (se cierra al pintar). */
  zone?: LatLng[]
  /** Carriles internos: cada uno una polilínea de [lng, lat]. La ruta los sigue. */
  lanes?: LatLng[][]
}

export function countsOf(spots: SpotFeature[]): Counts {
  const free = spots.filter((s) => s.properties.state === 'free').length
  return { free, busy: spots.length - free, total: spots.length }
}

/** Centroide [lng, lat] de un anillo de puntos; null si está vacío. */
export function ringCentroid(ring: LatLng[]): LatLng | null {
  if (!ring.length) return null
  let x = 0, y = 0
  for (const [lng, lat] of ring) {
    x += lng
    y += lat
  }
  return [x / ring.length, y / ring.length]
}

/** Centroide [lng, lat] de los espacios; null si no hay. */
export function centroidOf(spots: SpotFeature[]): LatLng | null {
  let x = 0, y = 0, n = 0
  for (const s of spots) {
    const ring = s.geometry.coordinates[0]
    // Los 4 primeros vértices (el 5º repite el 1º para cerrar el anillo).
    for (let i = 0; i < 4 && i < ring.length; i++) {
      x += ring[i][0]
      y += ring[i][1]
      n++
    }
  }
  return n ? [x / n, y / n] : null
}

/** Dónde poner la etiqueta del parqueadero: centro de la zona, o de los espacios. */
export function lotCenter(lot: Lot): LatLng | null {
  return (lot.zone && ringCentroid(lot.zone)) || centroidOf(lot.spots)
}

/** Centro [lng, lat] de un espacio (promedio de sus 4 vértices). */
export function spotCenter(s: SpotFeature): LatLng {
  const ring = s.geometry.coordinates[0]
  const n = Math.min(4, ring.length)
  let x = 0, y = 0
  for (let i = 0; i < n; i++) {
    x += ring[i][0]
    y += ring[i][1]
  }
  return [x / n, y / n]
}

/** ¿El punto [lng,lat] está dentro del anillo? Ray casting. */
export function pointInRing(p: LatLng, ring: LatLng[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const hit = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

/** Parqueadero cuya zona contiene el punto [lng,lat], o null. */
export function lotContaining(lots: Lot[], p: LatLng): Lot | null {
  for (const l of lots) if (l.zone && l.zone.length >= 3 && pointInRing(p, l.zone)) return l
  return null
}

/** Distancia en metros entre dos [lng, lat] (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toR = Math.PI / 180, R = 6371000
  const dLat = (b[1] - a[1]) * toR
  const dLng = (b[0] - a[0]) * toR
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface NearestSpot {
  id: number
  center: LatLng
  dist: number
}

/** Espacio LIBRE más cercano al punto [lng,lat] dentro del parqueadero. */
export function nearestFreeSpot(lot: Lot, p: LatLng): NearestSpot | null {
  let best: NearestSpot | null = null
  for (const s of lot.spots) {
    if (s.properties.state !== 'free') continue
    const center = spotCenter(s)
    const dist = distanceMeters(p, center)
    if (!best || dist < best.dist) best = { id: s.properties.id, center, dist }
  }
  return best
}

export const newLotId = () => `${Date.now()}-${Math.floor(Math.random() * 1e4)}`
