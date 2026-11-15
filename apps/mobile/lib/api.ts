import { supabase } from './supabase'
import { lotFromRow, spaceToSpot, spaceUpdatedAt, type LotRow, type SpaceRow } from './mapping'
import type { SpotFeature } from '../components/Map'
import type { Lot } from './lots'

export interface Zone {
  id: string
  name: string
  level?: number | null
}

export interface Occupancy {
  free: number
  occupied: number
  no_data: number
  total: number
}

export interface Camera {
  id: string
  name: string
  is_online: boolean
  last_seen_at?: string | null
}

function throwIf(error: unknown) {
  if (error) throw error
}

/** Endpoint 1: parqueaderos (sin puestos todavía). */
export async function fetchLots(): Promise<Lot[]> {
  const { data, error } = await supabase
    .from('parking_lot')
    .select('id,name,address,boundary,lanes')
  throwIf(error)
  return (data as LotRow[] ?? []).map((r) => lotFromRow(r))
}

/** Endpoint 2: zonas activas de un parqueadero. */
export async function fetchZones(lotId: string): Promise<Zone[]> {
  const { data, error } = await supabase
    .from('zone')
    .select('id,name,level,boundary')
    .eq('parking_lot_id', lotId)
    .eq('is_active', true)
  throwIf(error)
  return (data as any[] ?? []).map((z) => ({ id: String(z.id), name: z.name, level: z.level }))
}

/** Endpoint 3: puestos + estado de una zona. Devuelve puestos y la hora del dato más reciente. */
export async function fetchSpaces(zoneId: string): Promise<{ spots: SpotFeature[]; updatedAt: number | null }> {
  const { data, error } = await supabase
    .from('space')
    .select('id,code,map_polygon,angle,space_state(status,confidence,updated_at)')
    .eq('zone_id', zoneId)
    .eq('is_active', true)
  throwIf(error)
  const rows = (data as SpaceRow[]) ?? []
  const spots = rows.map(spaceToSpot)
  const updatedAt = rows.reduce<number | null>((max, r) => {
    const t = spaceUpdatedAt(r)
    return t && (!max || t > max) ? t : max
  }, null)
  return { spots, updatedAt }
}

/** Endpoint 4: ocupación del lote (o de una zona). */
export async function fetchOccupancy(lotId: string, zoneId?: string): Promise<Occupancy | null> {
  const body: Record<string, unknown> = { lot_id: lotId }
  if (zoneId) body.zone_id = zoneId
  const { data, error } = await supabase.rpc('get_occupancy', body)
  throwIf(error)
  return (data as Occupancy[] ?? [])[0] ?? null
}

/** Cámaras del parqueadero (se consulta cada 10 s). */
export async function fetchCameras(lotId: string): Promise<Camera[]> {
  const { data, error } = await supabase
    .from('camera_status')
    .select('id,name,is_online,last_seen_at')
    .eq('parking_lot_id', lotId)
  throwIf(error)
  return (data as any[] ?? []).map((c) => ({ id: String(c.id), name: c.name, is_online: c.is_online, last_seen_at: c.last_seen_at }))
}

// --- Admin RPC (sesión iniciada con signInWithPassword) ---

export async function adminUpsertSpace(payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('admin_upsert_space', { payload })
  throwIf(error)
  return data
}

export async function adminDeleteSpace(spaceId: number) {
  const { error } = await supabase.rpc('admin_delete_space', { space_id: spaceId })
  throwIf(error)
}

// --- Cuenta y favoritos (cambio E) ---

export interface Favorite {
  id: number
  parking_lot_id: number
  zone_id: number | null
  notify: boolean
  notify_days: number[] | null
  notify_time: string | null
}

const FAVORITE_COLS = 'id,parking_lot_id,zone_id,notify,notify_days,notify_time'

export async function signUp(email: string, password: string) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL || undefined,
      data: { privacy_accepted_at: new Date().toISOString() },
    },
  })
  throwIf(error)
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  throwIf(error)
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  throwIf(error)
}

/** Borra la cuenta vía RPC y cierra la sesión local. */
export async function deleteMyAccount() {
  const { error } = await supabase.rpc('delete_my_account')
  throwIf(error)
  await supabase.auth.signOut({ scope: 'local' })
}

export async function fetchFavorites(): Promise<Favorite[]> {
  const { data, error } = await supabase.from('favorite').select(FAVORITE_COLS).order('created_at')
  throwIf(error)
  return (data as Favorite[]) ?? []
}

export async function addFavorite(userId: string, lotId: string, zoneId: string | null) {
  const { error } = await supabase
    .from('favorite')
    .insert({ user_id: userId, parking_lot_id: Number(lotId), zone_id: zoneId ? Number(zoneId) : null })
  throwIf(error)
}

export async function updateFavorite(id: number, patch: Partial<Pick<Favorite, 'notify' | 'notify_days' | 'notify_time'>>) {
  const { error } = await supabase.from('favorite').update(patch).eq('id', id)
  throwIf(error)
}

export async function removeFavorite(id: number) {
  const { error } = await supabase.from('favorite').delete().eq('id', id)
  throwIf(error)
}
