import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Map, type LatLng, type LotLabel, type Mode, type SpotFeature, type ZoneGeo } from './components/Map'
import { countsOf, lotCenter, lotContaining, nearestFreeSpot, type Lot } from './lib/lots'
import { theme } from './lib/theme'
import { useLotData, useLiveSpaces, useSession, useFavorites, useFreeSpotAlerts } from './lib/hooks'
import { fetchZones, fetchOccupancy, fetchCameras, adminUpsertSpace, adminDeleteSpace, type Zone, type Occupancy, type Camera } from './lib/api'
import { supabase } from './lib/supabase'
import { AuthScreen } from './components/AuthScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { PrivacyScreen } from './components/PrivacyScreen'
import { ErrorBoundary } from './components/ErrorBoundary'

const HINTS: Record<Mode, string> = {
  view: 'Toca un espacio para marcar libre/ocupado',
  spot: 'Toca el mapa para añadir un espacio',
  row: 'Toca inicio y fin para generar una fila',
  zone: 'Toca puntos para el contorno; Terminar para cerrar',
  lane: 'Toca puntos del carril; Terminar para guardarlo',
}

function agoText(ms: number | null): string {
  if (!ms) return 'Sin datos'
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 60) return `En vivo · hace ${s} s`
  return `Última actualización hace ${Math.round(s / 60)} min`
}

function AppContent() {
  const [loc, setLoc] = useState<LatLng | null>(null)
  const { lots, loading, error, reload } = useLotData()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [occupancy, setOccupancy] = useState<Occupancy | null>(null)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [mode, setMode] = useState<Mode>('view')
  const [appMode, setAppMode] = useState<'driver' | 'admin'>('driver')
  const [angle, setAngle] = useState(0)
  const [undoNonce, setUndoNonce] = useState(0)
  const [clearNonce, setClearNonce] = useState(0)
  const [finishNonce, setFinishNonce] = useState(0)
  const [target, setTarget] = useState<{ center: LatLng; dist: number; text: string } | null>(null)
  const { session } = useSession()
  const [authOpen, setAuthOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const pendingZone = useRef<string | null>(null) // zona a abrir tras cambiar de parqueadero
  const [login, setLogin] = useState<null | { email: string; pass: string; err: string }>(null)
  const [tick, setTick] = useState(0) // refresca el texto "hace N s"
  const prevSpots = useRef<SpotFeature[]>([])

  const live = useLiveSpaces(zoneId)

  // Selección inicial del primer parqueadero cuando cargan.
  useEffect(() => {
    if (!activeId && lots.length) setActiveId(lots[0].id)
  }, [lots, activeId])

  // Ubicación (igual que antes).
  useEffect(() => {
    ;(async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync()
      if (!granted) return
      const pos = await Location.getCurrentPositionAsync({})
      setLoc([pos.coords.latitude, pos.coords.longitude])
    })()
  }, [])

  const userId = session?.user.id ?? null
  const { favorites, reload: reloadFavorites } = useFavorites(userId)

  // Abre la zona de un aviso (notificación o banner C06).
  const openZone = ({ lotId, zoneId: zId }: { lotId: string; zoneId: string }) => {
    if (lotId === activeId) { setZoneId(zId); return }
    pendingZone.current = zId
    setActiveId(lotId)
  }
  const alerts = useFreeSpotAlerts(favorites, openZone)

  // Zonas del parqueadero activo.
  useEffect(() => {
    if (!activeId) { setZones([]); setZoneId(null); return }
    fetchZones(activeId).then((zs) => {
      setZones(zs)
      const wanted = pendingZone.current
      pendingZone.current = null
      setZoneId(zs.find((z) => z.id === wanted)?.id ?? zs[0]?.id ?? null)
    }).catch(() => setZones([]))
  }, [activeId])

  // Ocupación total del lote (y de la zona si hay) al recargar/cambiar.
  useEffect(() => {
    if (!activeId) return
    fetchOccupancy(activeId, zoneId ?? undefined).then(setOccupancy).catch(() => setOccupancy(null))
  }, [activeId, zoneId, live.updatedAt])

  // Cámaras cada 10 s.
  useEffect(() => {
    if (!activeId) return
    let on = true
    const poll = () => fetchCameras(activeId).then((c) => on && setCameras(c)).catch(() => {})
    poll()
    const id = setInterval(poll, 10000)
    return () => { on = false; clearInterval(id) }
  }, [activeId])

  // Refresca el contador "hace N s" cada segundo.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const active = lots.find((l) => l.id === activeId) ?? null
  const cameraDown = cameras.some((c) => !c.is_online)
  // Si una cámara está caída, los puestos de la zona van a no_data (spec).
  const visibleSpots: SpotFeature[] = cameraDown
    ? live.spots.map((s) => ({ ...s, properties: { ...s.properties, status: 'no_data' } }))
    : live.spots
  // Lot con los puestos en vivo para pintarlo en el mapa.
  const activeLive: Lot | null = active ? { ...active, spots: visibleSpots } : null
  const counts = countsOf(visibleSpots)
  // Línea base para detectar ediciones del admin: los puestos cargados de la BD.
  useEffect(() => { prevSpots.current = visibleSpots }, [visibleSpots])

  const labels = useMemo<LotLabel[]>(() => {
    const out: LotLabel[] = []
    for (const l of lots) {
      const center = lotCenter(l)
      if (!center) continue
      out.push({ id: l.id, name: l.name, free: 0, total: 0, center })
    }
    return out
  }, [lots])

  const zoneGeos = useMemo<ZoneGeo[]>(
    () =>
      lots
        .filter((l) => l.zone && l.zone.length >= 3)
        .map((l) => ({ id: l.id, ring: l.zone as LatLng[], active: l.id === activeId })),
    [lots, activeId],
  )

  // Admin dibuja: persiste los puestos nuevos/cambiados y borra los eliminados vía RPC.
  const onSpots = async (spots: SpotFeature[]) => {
    const before = prevSpots.current
    prevSpots.current = spots
    if (appMode !== 'admin' || !zoneId) return
    try {
      const prevById: Record<number, SpotFeature> = {}
      for (const s of before) prevById[s.properties.id] = s
      for (const s of spots) {
        const old = prevById[s.properties.id]
        if (!old || old.properties.status !== s.properties.status || old.geometry.coordinates[0].length !== s.geometry.coordinates[0].length) {
          await adminUpsertSpace({ ...(old ? { id: s.properties.id } : { code: String(s.properties.id) }), zone_id: zoneId, map_polygon: s.geometry.coordinates[0] })
        }
      }
      const now = new Set(spots.map((s) => s.properties.id))
      for (const s of before) if (!now.has(s.properties.id)) await adminDeleteSpace(s.properties.id)
    } catch (e: any) {
      const code = e?.code ?? e?.status
      setLogin({ email: '', pass: '', err: code === '401' || code === '403' || code === 401 || code === 403 ? 'Sin permiso de administrador (401/403)' : String(e?.message ?? e) })
    }
  }

  const rotate = (d: number) => setAngle((a) => ((a + d) % 360 + 360) % 360)
  const toggle = (m: Mode) => setMode((cur) => (cur === m ? 'view' : m))
  const isAdmin = appMode === 'admin'

  const switchAppMode = () => {
    if (!isAdmin && !session) { setLogin({ email: '', pass: '', err: '' }); return }
    setMode('view')
    setAppMode(isAdmin ? 'driver' : 'admin')
  }

  const doLogin = async () => {
    if (!login) return
    const { error } = await supabase.auth.signInWithPassword({ email: login.email, password: login.pass })
    if (error) { setLogin({ ...login, err: error.message }); return }
    setLogin(null)
    setMode('view')
    setAppMode('admin')
  }

  const findNearest = () => {
    if (!loc) { setTarget({ center: [0, 0], dist: 0, text: 'Sin ubicación — activa el GPS' }); return }
    const p: LatLng = [loc[1], loc[0]]
    const lot = lotContaining(lots.map((l) => (l.id === activeId ? activeLive! : l)), p) ?? activeLive
    if (!lot) { setTarget({ center: [0, 0], dist: 0, text: 'No estás en ningún parqueadero' }); return }
    if (lot.id !== activeId) setActiveId(lot.id)
    const near = nearestFreeSpot(lot, p)
    if (!near) { setTarget({ center: [0, 0], dist: 0, text: `Sin cupos libres en ${lot.name}` }); return }
    setTarget({ center: near.center, dist: Math.round(near.dist), text: `Cupo en ${lot.name} · a ${Math.round(near.dist)} m` })
  }
  const hasRoute = target !== null && target.dist > 0
  void tick // fuerza re-render cada segundo para el texto "hace N s"
  const liveLabel = agoText(live.updatedAt)

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <Map
          userLoc={loc}
          mode={mode}
          angle={angle}
          undoNonce={undoNonce}
          clearNonce={clearNonce}
          finishNonce={finishNonce}
          activeId={activeId}
          activeSpots={visibleSpots}
          labels={labels}
          zones={zoneGeos}
          target={hasRoute ? target!.center : null}
          lanes={active?.lanes ?? []}
          onSpots={onSpots}
          onZone={() => setMode('view')}
          onLane={() => {}}
          onSelectLot={setActiveId}
        />

        <SafeAreaView style={styles.topWrap} pointerEvents="box-none">
          <View style={styles.topbar}>
            <View style={styles.topText}>
              <Text style={styles.title}>{active ? active.name : loading ? 'Cargando…' : error ? 'Sin conexión' : 'Sin parqueadero'}</Text>
              <Text style={styles.sub}>{active ? liveLabel : error ? 'Revisa tu conexión' : 'Abre con conexión para empezar'}</Text>
            </View>
            <TouchableOpacity style={styles.modeBtn} onPress={() => setPrivacyOpen(true)} accessibilityLabel="Privacidad y términos">
              <MaterialCommunityIcons name="information-outline" size={18} color={theme.text} />
            </TouchableOpacity>
            {/* Favoritos: sin sesión lleva a C04 */}
            <TouchableOpacity style={styles.modeBtn} onPress={() => (session ? setProfileOpen(true) : setAuthOpen(true))} accessibilityLabel="Guardar como favorito">
              <MaterialCommunityIcons name={session ? 'heart' : 'heart-outline'} size={18} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeBtn, isAdmin && styles.toolOn]} onPress={switchAppMode}>
              <MaterialCommunityIcons name={isAdmin ? 'shield-account' : 'steering'} size={18} color={isAdmin ? theme.onPrimary : theme.text} />
              <Text style={[styles.toolTxt, isAdmin && styles.toolTxtOn]}>{isAdmin ? 'Administrador' : 'Conductor'}</Text>
            </TouchableOpacity>
          </View>

          {/* Selector de parqueadero */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {lots.map((l) => {
              const on = l.id === activeId
              return (
                <TouchableOpacity key={l.id} style={[styles.chip, on && styles.chipOn]} onPress={() => setActiveId(l.id)}>
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{l.name}</Text>
                </TouchableOpacity>
              )
            })}
            {!loading && !lots.length && (
              <TouchableOpacity style={styles.chip} onPress={reload}>
                <Text style={styles.chipTxt}>Reintentar</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Filtro por zona */}
          {zones.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
              {zones.map((z) => {
                const on = z.id === zoneId
                return (
                  <TouchableOpacity key={z.id} style={[styles.chip, on && styles.chipOn]} onPress={() => setZoneId(z.id)}>
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{z.name}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}

          {/* Herramientas admin (dibujo, igual que antes) */}
          {active && isAdmin && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                <TouchableOpacity style={[styles.tool, styles.iconRow, styles.mr8, mode === 'spot' && styles.toolOn]} onPress={() => toggle('spot')}>
                  <MaterialCommunityIcons name="pencil" size={18} color={mode === 'spot' ? theme.onPrimary : theme.text} />
                  <Text style={[styles.toolTxt, mode === 'spot' && styles.toolTxtOn]}>Espacio</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tool, styles.iconRow, styles.mr8, mode === 'row' && styles.toolOn]} onPress={() => toggle('row')}>
                  <MaterialCommunityIcons name="ruler" size={18} color={mode === 'row' ? theme.onPrimary : theme.text} />
                  <Text style={[styles.toolTxt, mode === 'row' && styles.toolTxtOn]}>Fila</Text>
                </TouchableOpacity>
              </ScrollView>
              <View style={styles.tools}>
                <TouchableOpacity style={[styles.tool, styles.iconRow]} onPress={() => setUndoNonce((n) => n + 1)}>
                  <MaterialCommunityIcons name="undo" size={18} color={theme.text} />
                  <Text style={styles.toolTxt}>Deshacer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tool, styles.iconRow]} onPress={() => setClearNonce((n) => n + 1)}>
                  <MaterialCommunityIcons name="delete-outline" size={18} color={theme.text} />
                  <Text style={styles.toolTxt}>Borrar</Text>
                </TouchableOpacity>
              </View>
              {mode === 'spot' && (
                <View style={styles.tools}>
                  <TouchableOpacity style={styles.tool} onPress={() => rotate(-15)}>
                    <MaterialCommunityIcons name="rotate-left" size={18} color={theme.text} />
                  </TouchableOpacity>
                  <View style={[styles.tool, styles.angleBox]}>
                    <Text style={styles.toolTxt}>{angle}°</Text>
                  </View>
                  <TouchableOpacity style={styles.tool} onPress={() => rotate(15)}>
                    <MaterialCommunityIcons name="rotate-right" size={18} color={theme.text} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </SafeAreaView>

        {/* Aviso de cámara sin señal */}
        {cameraDown && (
          <View style={[styles.banner, styles.bannerWarn, styles.camBanner]}>
            <Text style={styles.bannerTxt}>Cámara sin señal</Text>
          </View>
        )}

        {/* C06: aviso dentro de la app cuando no hay permiso de notificaciones */}
        {alerts.banner && (
          <View style={[styles.banner, styles.bannerOk, styles.alertBanner]}>
            <TouchableOpacity style={styles.bannerBody} onPress={alerts.openBanner}>
              <Text style={styles.bannerTxt}>{alerts.banner.text}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={alerts.dismissBanner}>
              <MaterialCommunityIcons name="close" size={18} color={theme.textSecondary} style={styles.bannerX} />
            </TouchableOpacity>
          </View>
        )}

        {lots.length > 0 && (
          <TouchableOpacity style={[styles.fab, styles.iconRow]} activeOpacity={0.85} onPress={findNearest}>
            <MaterialCommunityIcons name="compass-outline" size={20} color={theme.onPrimary} />
            <Text style={styles.fabTxt}>Buscar cupo</Text>
          </TouchableOpacity>
        )}

        {target && (
          <View style={[styles.banner, hasRoute ? styles.bannerOk : styles.bannerWarn]}>
            <Text style={styles.bannerTxt}>{target.text}</Text>
            <TouchableOpacity onPress={() => setTarget(null)}>
              <MaterialCommunityIcons name="close" size={18} color={theme.textSecondary} style={styles.bannerX} />
            </TouchableOpacity>
          </View>
        )}

        {active && (
          <View style={styles.sheet}>
            <View style={styles.stat}>
              <Text style={[styles.statN, { color: theme.free }]}>{counts.free}</Text>
              <Text style={styles.statL}>Libres</Text>
            </View>
            <View style={styles.sep} />
            <View style={styles.stat}>
              <Text style={[styles.statN, { color: theme.occupied }]}>{counts.occupied}</Text>
              <Text style={styles.statL}>Ocupados</Text>
            </View>
            <View style={styles.sep} />
            <View style={styles.stat}>
              <Text style={[styles.statN, { color: theme.noData }]}>{counts.noData}</Text>
              <Text style={styles.statL}>Sin datos</Text>
            </View>
            <View style={styles.sep} />
            <View style={styles.stat}>
              <Text style={styles.statN}>{occupancy?.total ?? counts.total}</Text>
              <Text style={styles.statL}>Total lote</Text>
            </View>
          </View>
        )}

        <PrivacyScreen visible={privacyOpen} onClose={() => setPrivacyOpen(false)} lotName={active?.name ?? null} />
        <AuthScreen visible={authOpen && !session} onClose={() => setAuthOpen(false)} />
        {session && (
          <ProfileScreen
            visible={profileOpen}
            onClose={() => setProfileOpen(false)}
            userId={session.user.id}
            email={session.user.email ?? ''}
            lots={lots}
            zones={zones}
            activeLotId={activeId}
            activeZoneId={zoneId}
            favorites={favorites}
            onChanged={reloadFavorites}
          />
        )}

        {/* Login admin */}
        <Modal visible={login !== null} transparent animationType="fade" onRequestClose={() => setLogin(null)}>
          <View style={styles.backdrop}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ingreso de administrador</Text>
              <TextInput style={styles.input} value={login?.email} onChangeText={(t) => setLogin((l) => l && { ...l, email: t })} placeholder="Correo" placeholderTextColor={theme.textSecondary} autoCapitalize="none" keyboardType="email-address" autoFocus />
              <TextInput style={[styles.input, styles.mt8]} value={login?.pass} onChangeText={(t) => setLogin((l) => l && { ...l, pass: t })} placeholder="Contraseña" placeholderTextColor={theme.textSecondary} secureTextEntry />
              {!!login?.err && <Text style={styles.errTxt}>{login.err}</Text>}
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.cardBtn} onPress={() => setLogin(null)}>
                  <Text style={styles.cardBtnTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cardBtn, styles.okBtn]} onPress={doLogin}>
                  <Text style={[styles.cardBtnTxt, { color: theme.onPrimary }]}>Entrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

const shadow = {
  shadowColor: theme.shadow,
  shadowOpacity: 0.18,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },

  topWrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14 },
  topbar: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(250,245,236,0.92)', borderRadius: 20, padding: 14, ...shadow },
  topText: { flex: 1 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '800', color: theme.text },
  sub: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginTop: 2 },

  chipsRow: { marginTop: 10, flexGrow: 0 },
  chip: { backgroundColor: 'rgba(250,245,236,0.95)', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14, marginRight: 8, ...shadow },
  chipOn: { backgroundColor: theme.primary },
  chipTxt: { fontSize: 14, fontWeight: '800', color: theme.text },
  chipTxtOn: { color: theme.onPrimary },

  tools: { flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'flex-start' },
  tool: { backgroundColor: 'rgba(250,245,236,0.95)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, ...shadow },
  toolOn: { backgroundColor: theme.primary },
  toolTxt: { fontSize: 14, fontWeight: '800', color: theme.text },
  toolTxtOn: { color: theme.onPrimary },
  angleBox: { minWidth: 56, alignItems: 'center' },
  mr8: { marginRight: 8 },
  mt8: { marginTop: 8 },

  sheet: { position: 'absolute', left: 14, right: 14, bottom: 24, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(250,245,236,0.96)', borderRadius: 20, paddingVertical: 14, ...shadow },
  stat: { flex: 1, alignItems: 'center' },
  statN: { fontSize: 22, fontWeight: '800', color: theme.text },
  statL: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginTop: 2 },
  sep: { width: 1, height: 32, backgroundColor: theme.border },

  fab: { position: 'absolute', right: 14, bottom: 108, backgroundColor: theme.primary, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, ...shadow },
  fabTxt: { color: theme.onPrimary, fontSize: 15, fontWeight: '800' },
  banner: { position: 'absolute', left: 14, right: 14, bottom: 172, flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, ...shadow },
  camBanner: { bottom: 230 },
  alertBanner: { bottom: 288 },
  bannerBody: { flex: 1 },
  bannerOk: { backgroundColor: theme.primaryTint },
  bannerWarn: { backgroundColor: theme.occupiedTint },
  bannerTxt: { flex: 1, fontSize: 14, fontWeight: '800', color: theme.text },
  bannerX: { fontSize: 16, fontWeight: '800', color: theme.textSecondary, paddingLeft: 10 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 28 },
  card: { backgroundColor: theme.surface, borderRadius: 22, padding: 20, ...shadow },
  cardTitle: { fontSize: 17, fontWeight: '800', color: theme.text, marginBottom: 14 },
  input: { backgroundColor: theme.onPrimary, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text },
  errTxt: { color: theme.occupied, fontSize: 13, fontWeight: '700', marginTop: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  cardBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  cardBtnTxt: { fontSize: 14, fontWeight: '800', color: theme.text },
  okBtn: { backgroundColor: theme.primary },
})
