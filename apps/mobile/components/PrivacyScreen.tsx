import { Alert, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { theme } from '../lib/theme'
import { PRIVACY_SECTIONS, PRIVACY_TITLE } from '../content/privacy'
import { feedbackUrl } from '../lib/feedback'

/** Abre el formulario de reporte con versión y parqueadero prellenados. */
export async function reportProblem(lotName: string | null) {
  const url = feedbackUrl(lotName)
  if (!url) {
    Alert.alert('Reportar un problema', 'El formulario de reportes no está configurado.')
    return
  }
  try {
    await Linking.openURL(url)
  } catch {
    Alert.alert('Reportar un problema', 'No se pudo abrir el formulario.')
  }
}

/** Privacidad y términos (hitos 21 y 22) con acceso a "Reportar un problema". */
export function PrivacyScreen({ visible, onClose, lotName }: { visible: boolean; onClose: () => void; lotName: string | null }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.close} onPress={onClose} accessibilityLabel="Cerrar">
          <MaterialCommunityIcons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{PRIVACY_TITLE}</Text>
        {PRIVACY_SECTIONS.map((s) => (
          <Text key={s.title} style={styles.para}>
            <Text style={styles.section}>{s.title + '\n'}</Text>
            {s.body}
          </Text>
        ))}
        <TouchableOpacity style={styles.outline} onPress={() => reportProblem(lotName)}>
          <Text style={styles.outlineTxt}>Reportar un problema</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { padding: 24, paddingTop: 56, paddingBottom: 48 },
  close: { position: 'absolute', top: 48, right: 24, zIndex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 12 },
  para: { fontSize: 14, lineHeight: 21, color: theme.text, marginTop: 14 },
  section: { fontSize: 15, fontWeight: '800' },
  outline: { borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingVertical: 12, alignItems: 'center', marginTop: 28 },
  outlineTxt: { fontWeight: '800', color: theme.text },
})
