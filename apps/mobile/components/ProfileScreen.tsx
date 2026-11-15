import { useState } from 'react'
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { theme } from '../lib/theme'
import { addFavorite, deleteMyAccount, removeFavorite, signOut, updateFavorite, type Favorite, type Zone } from '../lib/api'
import { ensureNotificationPermission } from '../lib/hooks'
import type { Lot } from '../lib/lots'
import { PrivacyScreen, reportProblem } from './PrivacyScreen'

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] // 1 = lunes ... 7 = domingo
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

interface Props {
  visible: boolean
  onClose: () => void
  userId: string
  email: string
  lots: Lot[]
  zones: Zone[]
  activeLotId: string | null
  activeZoneId: string | null
  favorites: Favorite[]
  onChanged: () => void
}

/** Perfil (cerrar sesión, borrar cuenta) y C05: favoritos con aviso, días y hora. */
export function ProfileScreen(p: Props) {
  const [err, setErr] = useState('')
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const lotName = p.lots.find((l) => l.id === p.activeLotId)?.name ?? null

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      setErr('')
      p.onChanged()
    } catch (e: any) {
      setErr(String(e?.message ?? e))
    }
  }

  const label = (f: Favorite) => {
    const lot = p.lots.find((l) => l.id === String(f.parking_lot_id))?.name ?? `Parqueadero ${f.parking_lot_id}`
    return f.zone_id == null ? lot : `${lot} · zona ${p.zones.find((z) => z.id === String(f.zone_id))?.name ?? f.zone_id}`
  }

  const toggleNotify = async (f: Favorite, on: boolean) => {
    if (on) await ensureNotificationPermission() // sin permiso igual funciona el banner C06
    run(() => updateFavorite(f.id, { notify: on }))
  }

  const toggleDay = (f: Favorite, day: number) => {
    const cur = f.notify_days ?? []
    const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day].sort()
    run(() => updateFavorite(f.id, { notify_days: next.length ? next : null }))
  }

  const setTime = (f: Favorite, text: string) => {
    if (text === '') run(() => updateFavorite(f.id, { notify_time: null }))
    else if (TIME_RE.test(text)) run(() => updateFavorite(f.id, { notify_time: text }))
    else setErr('Hora inválida: usa HH:MM (por ejemplo 11:00)')
  }

  const confirmDelete = () =>
    Alert.alert('Borrar mi cuenta', 'Se borrarán tu perfil y tus favoritos. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => run(async () => { await deleteMyAccount(); p.onClose() }) },
    ])

  return (
    <Modal visible={p.visible} animationType="slide" onRequestClose={p.onClose}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.close} onPress={p.onClose}>
          <MaterialCommunityIcons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Mi perfil</Text>
        <Text style={styles.email}>{p.email}</Text>

        <Text style={styles.section}>Favoritos</Text>
        {p.favorites.length === 0 && <Text style={styles.muted}>Aún no tienes favoritos.</Text>}
        {p.favorites.map((f) => (
          <View key={f.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={[styles.cardTitle, styles.flex]}>{label(f)}</Text>
              <TouchableOpacity onPress={() => run(() => removeFavorite(f.id))}>
                <MaterialCommunityIcons name="delete-outline" size={22} color={theme.occupied} />
              </TouchableOpacity>
            </View>
            <View style={styles.row}>
              <Text style={styles.flex}>Avísame si se libera</Text>
              <Switch value={f.notify} onValueChange={(v) => toggleNotify(f, v)} />
            </View>
            {f.notify && (
              <>
                <View style={styles.days}>
                  {DAYS.map((d, i) => {
                    const on = (f.notify_days ?? []).includes(i + 1)
                    return (
                      <TouchableOpacity key={d} style={[styles.day, on && styles.dayOn]} onPress={() => toggleDay(f, i + 1)}>
                        <Text style={[styles.dayTxt, on && styles.dayTxtOn]}>{d}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                <Text style={styles.muted}>Sin días marcados = todos los días</Text>
                <TextInput
                  style={styles.input}
                  defaultValue={f.notify_time?.slice(0, 5) ?? ''}
                  onEndEditing={(e) => setTime(f, e.nativeEvent.text.trim())}
                  placeholder="Desde la hora (HH:MM, opcional)"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numbers-and-punctuation"
                />
              </>
            )}
          </View>
        ))}

        {p.activeLotId && (
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.flex]} onPress={() => run(() => addFavorite(p.userId, p.activeLotId!, null))}>
              <Text style={styles.btnTxt}>Guardar parqueadero</Text>
            </TouchableOpacity>
            {p.activeZoneId && (
              <TouchableOpacity style={[styles.btn, styles.flex]} onPress={() => run(() => addFavorite(p.userId, p.activeLotId!, p.activeZoneId))}>
                <Text style={styles.btnTxt}>Guardar zona</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!!err && <Text style={styles.err}>{err}</Text>}

        <TouchableOpacity style={styles.outline} onPress={() => setPrivacyOpen(true)}>
          <Text style={styles.outlineTxt}>Privacidad y términos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outline} onPress={() => reportProblem(lotName)}>
          <Text style={styles.outlineTxt}>Reportar un problema</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outline} onPress={() => run(async () => { await signOut(); p.onClose() })}>
          <Text style={styles.outlineTxt}>Cerrar sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outline} onPress={confirmDelete}>
          <Text style={[styles.outlineTxt, { color: theme.occupied }]}>Borrar mi cuenta</Text>
        </TouchableOpacity>
      </ScrollView>
      <PrivacyScreen visible={privacyOpen} onClose={() => setPrivacyOpen(false)} lotName={lotName} />
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { padding: 24, paddingTop: 56, paddingBottom: 48 },
  close: { position: 'absolute', top: 48, right: 24, zIndex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: theme.text },
  email: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  section: { fontSize: 16, fontWeight: '800', color: theme.text, marginTop: 24, marginBottom: 8 },
  muted: { fontSize: 12, color: theme.textSecondary, marginVertical: 4 },
  card: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  flex: { flex: 1 },
  days: { flexDirection: 'row', gap: 6, marginTop: 8 },
  day: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: theme.primary, borderColor: theme.primary },
  dayTxt: { fontWeight: '800', color: theme.text },
  dayTxtOn: { color: theme.onPrimary },
  input: { backgroundColor: theme.onPrimary, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.text, marginTop: 8 },
  btn: { backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  btnTxt: { color: theme.onPrimary, fontWeight: '800' },
  err: { color: theme.occupied, fontSize: 13, fontWeight: '700', marginTop: 12 },
  outline: { borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  outlineTxt: { fontWeight: '800', color: theme.text },
})
