import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { fetchLots, fetchSpaces } from './api'
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
