import { useEffect, useMemo, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { fetchOccupancy, fetchZones, type Favorite, type Occupancy } from '../lib/api'
import type { Lot } from '../lib/lots'
import { filterLots, lotState, type LotFilter, type LotState, type PickerItem } from '../lib/lotPicker'
import { theme } from '../lib/theme'

interface Props {
  visible: boolean
  lots: Lot[]
  activeId: string | null
  favorites: Favorite[]
  onSelect: (id: string) => void
  onClose: () => void
}

const FILTERS: { key: LotFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'free', label: 'Con cupos' },
  { key: 'favorites', label: 'Favoritos' },
]

const DOT: Record<LotState, string> = { free: theme.free, full: theme.occupied, no_data: theme.noData }

export function LotPicker({ visible, lots, activeId, favorites, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LotFilter>('all')
  // Ocupación y nº de zonas por lote, con los endpoints existentes; se piden al abrir.
  const [stats, setStats] = useState<Record<string, { occ: Occupancy | null; zones: number | null }>>({})

  useEffect(() => {
    if (!visible) return
    setQuery('')
    setFilter('all')
    let on = true
    for (const l of lots) {
      Promise.all([
        fetchOccupancy(l.id).catch(() => null),
        fetchZones(l.id).then((z) => z.length).catch(() => null),
      ]).then(([occ, zones]) => on && setStats((s) => ({ ...s, [l.id]: { occ, zones } })))
    }
    return () => { on = false }
  }, [visible, lots])

  const items = useMemo<PickerItem[]>(() => {
    const favIds = new Set(favorites.map((f) => String(f.parking_lot_id)))
    return lots.map((l) => ({ id: l.id, name: l.name, zones: stats[l.id]?.zones ?? null, occ: stats[l.id]?.occ ?? null, favorite: favIds.has(l.id) }))
  }, [lots, favorites, stats])

  const shown = filterLots(items, query, filter)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.dismiss} activeOpacity={1} onPress={onClose} accessibilityLabel="Cerrar selector" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.head}>
            <Text style={styles.title}>Elegir parqueadero</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
              <MaterialCommunityIcons name="close" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar parqueadero"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
          />
          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <TouchableOpacity key={f.key} style={[styles.chip, filter === f.key && styles.chipOn]} onPress={() => setFilter(f.key)}>
                <Text style={[styles.chipTxt, filter === f.key && styles.chipTxtOn]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FlatList
            data={shown}
            keyExtractor={(it) => it.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>Sin resultados. Prueba con otro nombre o quita el filtro.</Text>}
            renderItem={({ item: it }) => {
              const state = lotState(it.occ)
              return (
                <TouchableOpacity style={styles.row} onPress={() => { onSelect(it.id); onClose() }} accessibilityLabel={it.name}>
                  <View style={[styles.dot, { backgroundColor: DOT[state] }]} />
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{it.name}</Text>
                    {it.zones !== null && <Text style={styles.meta}>{it.zones} {it.zones === 1 ? 'zona' : 'zonas'}</Text>}
                  </View>
                  <Text style={[styles.meta, state === 'free' && { color: theme.free }]}>
                    {it.occ === null ? '' : state === 'no_data' ? 'Sin datos' : `${it.occ.free} libres de ${it.occ.total}`}
                  </Text>
                  {it.id === activeId && <MaterialCommunityIcons name="check" size={20} color={theme.primary} style={styles.check} />}
                </TouchableOpacity>
              )
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: { maxHeight: '75%', backgroundColor: theme.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', color: theme.text },
  input: { backgroundColor: theme.onPrimary, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: theme.text },
  filters: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  chip: { borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
  chipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipTxt: { fontSize: 13, fontWeight: '800', color: theme.text },
  chipTxtOn: { color: theme.onPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: theme.text },
  meta: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginTop: 1 },
  check: { marginLeft: 4 },
  empty: { textAlign: 'center', color: theme.textSecondary, fontSize: 14, fontWeight: '600', paddingVertical: 24 },
})
