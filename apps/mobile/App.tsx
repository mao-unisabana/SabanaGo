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
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Map, type LatLng, type LotLabel, type Mode, type SpotFeature, type ZoneGeo } from './components/Map'
import { countsOf, lotCenter, lotContaining, nearestFreeSpot, newLotId, type Lot } from './lib/lots'

const STORE = 'parking.lots'

const HINTS: Record<Mode, string> = {
  view: 'Toca un espacio para marcar libre/ocupado',
  spot: 'Toca el mapa para añadir un espacio',
  row: 'Toca inicio y fin para generar una fila',
  zone: 'Toca puntos para el contorno; ✓ Terminar para cerrar',
  lane: 'Toca puntos del carril; ✓ Terminar para guardarlo',
}

export default function App() {
  const [loc, setLoc] = useState<LatLng | null>(null)
  const [lots, setLots] = useState<Lot[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('view')
  const [angle, setAngle] = useState(0)
  const [undoNonce, setUndoNonce] = useState(0)
  const [clearNonce, setClearNonce] = useState(0)
  const [finishNonce, setFinishNonce] = useState(0)
  const [modal, setModal] = useState<null | 'create' | 'rename'>(null)
  const [draft, setDraft] = useState('')
  const [target, setTarget] = useState<{ center: LatLng; dist: number; text: string } | null>(null)
  const hydrated = useRef(false)

  // Cargar parqueaderos (y migrar los espacios sueltos guardados antes).
  useEffect(() => {
    ;(async () => {
      const raw = await AsyncStorage.getItem(STORE)
      let loaded: Lot[] = raw ? JSON.parse(raw) : []
      if (!loaded.length) {
        const old = await AsyncStorage.getItem('parking.spots')
        const spots: SpotFeature[] = old ? JSON.parse(old) : []
        if (spots.length) loaded = [{ id: newLotId(), name: 'Parqueadero 1', spots }]
      }
      setLots(loaded)
      setActiveId(loaded[0]?.id ?? null)
      hydrated.current = true
    })()
  }, [])

  // Persistir (tras hidratar, para no pisar lo guardado con el estado inicial vacío).
  useEffect(() => {
    if (hydrated.current) AsyncStorage.setItem(STORE, JSON.stringify(lots))
  }, [lots])

  useEffect(() => {
    ;(async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync()
      if (!granted) return
      const pos = await Location.getCurrentPositionAsync({})
      setLoc([pos.coords.latitude, pos.coords.longitude])
    })()
  }, [])

  const active = lots.find((l) => l.id === activeId) ?? null
  const counts = countsOf(active?.spots ?? [])

  // Etiqueta de CADA parqueadero (centro de su zona o de sus espacios).
  const labels = useMemo<LotLabel[]>(() => {
    const out: LotLabel[] = []
    for (const l of lots) {
      const center = lotCenter(l)
      if (!center) continue
      const c = countsOf(l.spots)
      out.push({ id: l.id, name: l.name, free: c.free, total: c.total, center })
    }
    return out
  }, [lots])

  // Contornos de todos los parqueaderos que tengan zona (el activo marcado).
  const zones = useMemo<ZoneGeo[]>(
    () =>
      lots
        .filter((l) => l.zone && l.zone.length >= 3)
        .map((l) => ({ id: l.id, ring: l.zone as LatLng[], active: l.id === activeId })),
    [lots, activeId],
  )

  const onSpots = (spots: SpotFeature[]) =>
    setLots((ls) => ls.map((l) => (l.id === activeId ? { ...l, spots } : l)))

  const onZone = (ring: LatLng[]) => {
    setLots((ls) => ls.map((l) => (l.id === activeId ? { ...l, zone: ring } : l)))
    setMode('view')
  }

  const onLane = (line: LatLng[]) =>
    setLots((ls) => ls.map((l) => (l.id === activeId ? { ...l, lanes: [...(l.lanes ?? []), line] } : l)))

  const clearLanes = () =>
    setLots((ls) => ls.map((l) => (l.id === activeId ? { ...l, lanes: [] } : l)))

  const rotate = (d: number) => setAngle((a) => ((a + d) % 360 + 360) % 360)
  const toggle = (m: Mode) => setMode((cur) => (cur === m ? 'view' : m))

  // Busca el cupo libre más cercano: detecta el parqueadero por tu GPS (zona) y,
  // si no estás dentro de ninguno, usa el activo.
  const findNearest = () => {
    if (!loc) {
      setTarget({ center: [0, 0], dist: 0, text: 'Sin ubicación — activa el GPS' })
      return
    }
    const p: LatLng = [loc[1], loc[0]] // [lng, lat]
    const lot = lotContaining(lots, p) ?? active
    if (!lot) {
      setTarget({ center: [0, 0], dist: 0, text: 'No estás en ningún parqueadero' })
      return
    }
    if (lot.id !== activeId) setActiveId(lot.id)
    const near = nearestFreeSpot(lot, p)
    if (!near) {
      setTarget({ center: [0, 0], dist: 0, text: `Sin cupos libres en ${lot.name}` })
      return
    }
    setTarget({ center: near.center, dist: Math.round(near.dist), text: `Cupo en ${lot.name} · a ${Math.round(near.dist)} m` })
  }
  const hasRoute = target !== null && target.dist > 0

  const openCreate = () => {
    setDraft('')
    setModal('create')
  }
  const openRename = () => {
    setDraft(active?.name ?? '')
    setModal('rename')
  }
  const confirmModal = () => {
    const name = draft.trim() || `Parqueadero ${lots.length + 1}`
    if (modal === 'create') {
      const lot: Lot = { id: newLotId(), name, spots: [] }
      setLots((ls) => [...ls, lot])
      setActiveId(lot.id)
      setMode('zone')
    } else if (modal === 'rename' && active) {
      setLots((ls) => ls.map((l) => (l.id === active.id ? { ...l, name } : l)))
    }
    setModal(null)
  }
  const deleteActive = () => {
    if (!active) return
    setLots((ls) => ls.filter((l) => l.id !== active.id))
    setActiveId((prev) => {
      const rest = lots.filter((l) => l.id !== prev)
      return rest[0]?.id ?? null
    })
    setModal(null)
  }

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
          activeSpots={active?.spots ?? []}
          labels={labels}
          zones={zones}
          target={hasRoute ? target!.center : null}
          lanes={active?.lanes ?? []}
          onSpots={onSpots}
          onZone={onZone}
          onLane={onLane}
          onSelectLot={setActiveId}
        />

        <SafeAreaView style={styles.topWrap} pointerEvents="box-none">
          <View style={styles.topbar}>
            <Text style={styles.title}>{active ? active.name : 'Sin parqueadero'}</Text>
            <Text style={styles.sub}>{active ? HINTS[mode] : 'Crea un parqueadero para empezar'}</Text>
          </View>

          {/* Chips de parqueaderos + crear */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {lots.map((l) => {
              const on = l.id === activeId
              return (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => (on ? openRename() : setActiveId(l.id))}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{l.name}</Text>
                </TouchableOpacity>
              )
            })}
            <TouchableOpacity style={styles.chip} onPress={openCreate}>
              <Text style={styles.chipTxt}>＋ Nuevo</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Herramientas (solo con parqueadero activo) */}
          {active && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                <TouchableOpacity style={[styles.tool, styles.mr8, mode === 'spot' && styles.toolOn]} onPress={() => toggle('spot')}>
                  <Text style={[styles.toolTxt, mode === 'spot' && styles.toolTxtOn]}>✏️ Espacio</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tool, styles.mr8, mode === 'row' && styles.toolOn]} onPress={() => toggle('row')}>
                  <Text style={[styles.toolTxt, mode === 'row' && styles.toolTxtOn]}>📏 Fila</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tool, styles.mr8, mode === 'zone' && styles.toolOn]} onPress={() => toggle('zone')}>
                  <Text style={[styles.toolTxt, mode === 'zone' && styles.toolTxtOn]}>⬠ Zona</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tool, styles.mr8, mode === 'lane' && styles.toolOn]} onPress={() => toggle('lane')}>
                  <Text style={[styles.toolTxt, mode === 'lane' && styles.toolTxtOn]}>🛣️ Carril</Text>
                </TouchableOpacity>
              </ScrollView>
              {(mode === 'zone' || mode === 'lane') && (
                <View style={styles.tools}>
                  <TouchableOpacity style={[styles.tool, styles.okBtn]} onPress={() => setFinishNonce((n) => n + 1)}>
                    <Text style={[styles.toolTxt, { color: '#fff' }]}>✓ Terminar {mode === 'zone' ? 'zona' : 'carril'}</Text>
                  </TouchableOpacity>
                  {mode === 'lane' && (
                    <TouchableOpacity style={styles.tool} onPress={clearLanes}>
                      <Text style={styles.toolTxt}>🧹 Borrar carriles</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View style={styles.tools}>
                <TouchableOpacity style={styles.tool} onPress={() => setUndoNonce((n) => n + 1)}>
                  <Text style={styles.toolTxt}>↩︎ Deshacer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tool} onPress={() => setClearNonce((n) => n + 1)}>
                  <Text style={styles.toolTxt}>🗑️ Borrar</Text>
                </TouchableOpacity>
              </View>
              {mode === 'spot' && (
                <View style={styles.tools}>
                  <TouchableOpacity style={styles.tool} onPress={() => rotate(-15)}>
                    <Text style={styles.toolTxt}>↺</Text>
                  </TouchableOpacity>
                  <View style={[styles.tool, styles.angleBox]}>
                    <Text style={styles.toolTxt}>{angle}°</Text>
                  </View>
                  <TouchableOpacity style={styles.tool} onPress={() => rotate(15)}>
                    <Text style={styles.toolTxt}>↻</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </SafeAreaView>

        {/* Buscar cupo (GPS) */}
        {lots.length > 0 && (
          <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={findNearest}>
            <Text style={styles.fabTxt}>🧭 Buscar cupo</Text>
          </TouchableOpacity>
        )}

        {/* Banner del cupo encontrado / mensaje */}
        {target && (
          <View style={[styles.banner, hasRoute ? styles.bannerOk : styles.bannerWarn]}>
            <Text style={styles.bannerTxt}>{target.text}</Text>
            <TouchableOpacity onPress={() => setTarget(null)}>
              <Text style={styles.bannerX}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Contador del parqueadero activo */}
        {active && (
          <View style={styles.sheet}>
            <View style={styles.stat}>
              <Text style={[styles.statN, { color: '#2f9e6f' }]}>{counts.free}</Text>
              <Text style={styles.statL}>Libres</Text>
            </View>
            <View style={styles.sep} />
            <View style={styles.stat}>
              <Text style={[styles.statN, { color: '#d7483f' }]}>{counts.busy}</Text>
              <Text style={styles.statL}>Ocupados</Text>
            </View>
            <View style={styles.sep} />
            <View style={styles.stat}>
              <Text style={styles.statN}>{counts.total}</Text>
              <Text style={styles.statL}>Total</Text>
            </View>
          </View>
        )}

        {/* Modal crear/renombrar */}
        <Modal visible={modal !== null} transparent animationType="fade" onRequestClose={() => setModal(null)}>
          <View style={styles.backdrop}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {modal === 'create' ? 'Nuevo parqueadero' : 'Renombrar'}
              </Text>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Nombre (p. ej. Parqueadero Andino)"
                placeholderTextColor="#9c957f"
                autoFocus
              />
              <View style={styles.cardRow}>
                {modal === 'rename' && (
                  <TouchableOpacity style={[styles.cardBtn, styles.delBtn]} onPress={deleteActive}>
                    <Text style={[styles.cardBtnTxt, { color: '#fff' }]}>Eliminar</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.cardBtn} onPress={() => setModal(null)}>
                  <Text style={styles.cardBtnTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cardBtn, styles.okBtn]} onPress={confirmModal}>
                  <Text style={[styles.cardBtnTxt, { color: '#fff' }]}>
                    {modal === 'create' ? 'Crear' : 'Guardar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaProvider>
  )
}

const shadow = {
  shadowColor: '#1b1b22',
  shadowOpacity: 0.18,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5EEDD' },

  topWrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14 },
  topbar: { marginTop: 8, backgroundColor: 'rgba(250,245,236,0.92)', borderRadius: 20, padding: 14, ...shadow },
  title: { fontSize: 15, fontWeight: '800', color: '#202B22' },
  sub: { fontSize: 12, fontWeight: '600', color: '#8c856f', marginTop: 2 },

  chipsRow: { marginTop: 10, flexGrow: 0 },
  chip: {
    backgroundColor: 'rgba(250,245,236,0.95)',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginRight: 8,
    ...shadow,
  },
  chipOn: { backgroundColor: '#16587B' },
  chipTxt: { fontSize: 14, fontWeight: '800', color: '#202B22' },
  chipTxtOn: { color: '#fff' },

  tools: { flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'flex-start' },
  tool: { backgroundColor: 'rgba(250,245,236,0.95)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, ...shadow },
  toolOn: { backgroundColor: '#16587B' },
  toolTxt: { fontSize: 14, fontWeight: '800', color: '#202B22' },
  toolTxtOn: { color: '#fff' },
  angleBox: { minWidth: 56, alignItems: 'center' },
  mr8: { marginRight: 8 },

  sheet: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250,245,236,0.96)',
    borderRadius: 20,
    paddingVertical: 14,
    ...shadow,
  },
  stat: { flex: 1, alignItems: 'center' },
  statN: { fontSize: 22, fontWeight: '800', color: '#202B22' },
  statL: { fontSize: 12, fontWeight: '600', color: '#8c856f', marginTop: 2 },
  sep: { width: 1, height: 32, backgroundColor: '#e0d9c8' },

  fab: { position: 'absolute', right: 14, bottom: 108, backgroundColor: '#16587B', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, ...shadow },
  fabTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  banner: { position: 'absolute', left: 14, right: 14, bottom: 172, flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, ...shadow },
  bannerOk: { backgroundColor: '#dff0f8' },
  bannerWarn: { backgroundColor: '#fde8e6' },
  bannerTxt: { flex: 1, fontSize: 14, fontWeight: '800', color: '#202B22' },
  bannerX: { fontSize: 16, fontWeight: '800', color: '#8c856f', paddingLeft: 10 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 28 },
  card: { backgroundColor: '#FAF5EC', borderRadius: 22, padding: 20, ...shadow },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#202B22', marginBottom: 14 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0d9c8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#202B22',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  cardBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  cardBtnTxt: { fontSize: 14, fontWeight: '800', color: '#202B22' },
  okBtn: { backgroundColor: '#16587B' },
  delBtn: { backgroundColor: '#d7483f' },
})
