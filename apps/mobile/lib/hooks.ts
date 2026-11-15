import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import type { Session } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { fetchFavorites, fetchLots, fetchSpaces, fetchZones, type Favorite, type Zone } from './api'
import { shouldNotify } from './alerts'
import { spaceToSpot, spaceUpdatedAt, type SpaceRow } from './mapping'
import type { SpotFeature } from '../components/Map'
import type { Lot } from './lots'

/** Carga la lista de parqueaderos, con estado de carga/error y recarga manual. */
export function useLotData() {
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setLots(await fetchLots())
      setError(null)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])
  return { lots, loading, error, reload }
}

const cacheKey = (zoneId: string) => `sabanago.cache.zone.${zoneId}`
const BACKOFF = [1000, 2000, 4000, 8000, 15000] // espera creciente, máx 15 s

export interface LiveSpaces {
  spots: SpotFeature[]
  /** Hora (ms) del último dato recibido; para "En vivo · hace N s". */
  updatedAt: number | null
  /** true si lo que se ve viene del caché (sin red). */
  stale: boolean
  error: Error | null
}

/**
 * Puestos de una zona en vivo: recarga completa, luego canal Realtime filtrado por
 * zona. Recarga al abrir, al volver a primer plano y al reconectar; espera creciente
 * ante CHANNEL_ERROR/TIMED_OUT. Caché en AsyncStorage: sin red pinta el último estado.
 */
export function useLiveSpaces(zoneId: string | null): LiveSpaces {
  const [state, setState] = useState<LiveSpaces>({ spots: [], updatedAt: null, stale: false, error: null })
  const spotsRef = useRef<SpotFeature[]>([])

  useEffect(() => {
    if (!zoneId) {
      setState({ spots: [], updatedAt: null, stale: false, error: null })
      return
    }
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    let retry = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const apply = (spots: SpotFeature[], updatedAt: number | null) => {
      spotsRef.current = spots
      setState({ spots, updatedAt, stale: false, error: null })
      AsyncStorage.setItem(cacheKey(zoneId), JSON.stringify({ spots, updatedAt, savedAt: Date.now() })).catch(() => {})
    }

    // Recarga completa; ante fallo intenta pintar el caché (nunca mapa vacío).
    const reload = async () => {
      try {
        const { spots, updatedAt } = await fetchSpaces(zoneId)
        if (!cancelled) apply(spots, updatedAt)
        retry = 0
      } catch (e) {
        const raw = await AsyncStorage.getItem(cacheKey(zoneId))
        if (cancelled) return
        if (raw) {
          const c = JSON.parse(raw)
          setState({ spots: c.spots, updatedAt: c.updatedAt, stale: true, error: e as Error })
        } else {
          setState((s) => ({ ...s, error: e as Error }))
        }
      }
    }

    const subscribe = () => {
      channel = supabase
        .channel(`space_state:${zoneId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'space_state', filter: `zone_id=eq.${zoneId}` }, (payload) => {
          const row = payload.new as { space_id?: number; status?: string; updated_at?: string }
          const t = row.updated_at ? Date.parse(row.updated_at) : Date.now()
          if (__DEV__) console.log('[latency]', Date.now() - t, 'ms')
          // Actualiza solo el puesto que cambió (reusa el canal de GeoJSON de Map vía estado).
          const next = spotsRef.current.map((s) =>
            s.properties.id === row.space_id
              ? spaceToSpot({ id: row.space_id, map_polygon: s.geometry.coordinates[0], space_state: { status: row.status, updated_at: row.updated_at } } as SpaceRow)
              : s,
          )
          spotsRef.current = next
          setState({ spots: next, updatedAt: t, stale: false, error: null })
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            const wait = BACKOFF[Math.min(retry, BACKOFF.length - 1)]
            retry++
            retryTimer = setTimeout(() => { reload().then(resubscribe) }, wait)
          }
        })
    }

    const resubscribe = () => {
      if (channel) supabase.removeChannel(channel)
      subscribe()
    }

    // Arranque: recarga completa ANTES de escuchar (requisito del spec).
    reload().then(subscribe)

    // Volver a primer plano o reconectar -> recarga.
    const appSub = AppState.addEventListener('change', (s) => { if (s === 'active') reload() })

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      if (channel) supabase.removeChannel(channel)
      appSub.remove()
    }
  }, [zoneId])

  return state
}

/** Sesión de Supabase (persistente); `loading` hasta leer la sesión guardada. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, loading }
}

/** Favoritos del usuario con sesión; sin sesión devuelve lista vacía. */
export function useFavorites(userId: string | null) {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async () => {
    if (!userId) { setFavorites([]); return }
    try {
      setFavorites(await fetchFavorites())
      setError(null)
    } catch (e) {
      setError(e as Error)
    }
  }, [userId])

  useEffect(() => { reload() }, [reload])
  return { favorites, error, reload }
}

// --- Aviso "se liberó un puesto" ---

export interface FreeSpotAlert {
  text: string
  lotId: string
  zoneId: string
}

const lastAlertKey = (favoriteId: number) => `sabanago.alert.last.${favoriteId}`

// En primer plano, mostrar la notificación local igual que en segundo plano.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
})

/** Pide permiso de notificaciones; true si quedó concedido. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Avisos', importance: Notifications.AndroidImportance.DEFAULT })
  }
  const cur = await Notifications.getPermissionsAsync()
  if (cur.granted) return true
  if (!cur.canAskAgain) return false
  return (await Notifications.requestPermissionsAsync()).granted
}

/**
 * Escucha Realtime de las zonas favoritas con aviso activo y avisa cuando un puesto
 * pasa a libre (regla en lib/alerts.ts). Con permiso: notificación local; sin permiso:
 * `banner` (C06). `onOpen` se llama al tocar la notificación o el banner.
 */
export function useFreeSpotAlerts(favorites: Favorite[], onOpen: (a: { lotId: string; zoneId: string }) => void) {
  const [banner, setBanner] = useState<FreeSpotAlert | null>(null)
  const lastRef = useRef<Record<number, number>>({})
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  // Cambia solo cuando cambian los favoritos con aviso (evita resuscribir en cada render).
  const watchKey = JSON.stringify(favorites.filter((f) => f.notify))

  useEffect(() => {
    const watched = (JSON.parse(watchKey) as Favorite[])
    if (!watched.length) return
    let cancelled = false
    const channels: ReturnType<typeof supabase.channel>[] = []

    const notifyUser = async (alert: FreeSpotAlert) => {
      if (await ensureNotificationPermission()) {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'SabanaGo', body: alert.text, data: { lotId: alert.lotId, zoneId: alert.zoneId } },
          trigger: null,
        })
      } else {
        setBanner(alert)
      }
    }

    ;(async () => {
      for (const fav of watched) {
        const raw = await AsyncStorage.getItem(lastAlertKey(fav.id)).catch(() => null)
        if (raw) lastRef.current[fav.id] = Number(raw)
        const lotId = String(fav.parking_lot_id)
        const zones = (await fetchZones(lotId).catch(() => [] as Zone[]))
          .filter((z) => fav.zone_id == null || z.id === String(fav.zone_id))
        if (cancelled) return
        for (const zone of zones) {
          const ch = supabase
            .channel(`alert:${fav.id}:${zone.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'space_state', filter: `zone_id=eq.${zone.id}` }, (payload) => {
              const now = Date.now()
              const ok = shouldNotify({
                oldStatus: (payload.old as { status?: string }).status,
                newStatus: (payload.new as { status?: string }).status,
                notify: fav.notify,
                notifyDays: fav.notify_days,
                notifyTime: fav.notify_time,
                now,
                lastNotifiedAt: lastRef.current[fav.id],
              })
              if (!ok) return
              lastRef.current[fav.id] = now
              AsyncStorage.setItem(lastAlertKey(fav.id), String(now)).catch(() => {})
              notifyUser({ text: `Hay puesto libre en ${zone.name}`, lotId, zoneId: zone.id }).catch(() => {})
            })
            .subscribe()
          channels.push(ch)
        }
      }
    })()

    return () => {
      cancelled = true
      channels.forEach((c) => supabase.removeChannel(c))
    }
  }, [watchKey])

  // Tocar la notificación abre la zona.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const d = r.notification.request.content.data as { lotId?: string; zoneId?: string }
      if (d?.lotId && d?.zoneId) onOpenRef.current({ lotId: d.lotId, zoneId: d.zoneId })
    })
    return () => sub.remove()
  }, [])

  const dismissBanner = () => setBanner(null)
  const openBanner = () => {
    if (banner) onOpenRef.current({ lotId: banner.lotId, zoneId: banner.zoneId })
    setBanner(null)
  }
  return { banner, dismissBanner, openBanner }
}
