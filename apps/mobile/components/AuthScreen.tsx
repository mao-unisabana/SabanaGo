import { useState } from 'react'
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { theme } from '../lib/theme'
import { signIn, signUp } from '../lib/api'
import { PrivacyScreen } from './PrivacyScreen'

const MIN_PASSWORD = 8

/** C04: registro e inicio de sesión del conductor (opcional). */
export function AuthScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  const canSubmit = !busy && email.trim() !== '' && (!register || accepted)

  const submit = async () => {
    if (password.length < MIN_PASSWORD) {
      setMsg({ text: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`, ok: false })
      return
    }
    setBusy(true)
    try {
      if (register) {
        await signUp(email.trim(), password)
        setMsg({ text: 'Cuenta creada. Confirma tu correo y luego inicia sesión.', ok: true })
        setRegister(false)
        setPassword('')
      } else {
        await signIn(email.trim(), password)
        setMsg(null)
        setPassword('')
        onClose()
      }
    } catch (e: any) {
      setMsg({ text: String(e?.message ?? e), ok: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.close} onPress={onClose}>
          <MaterialCommunityIcons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{register ? 'Crear cuenta' : 'Iniciar sesión'}</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Correo" placeholderTextColor={theme.textSecondary} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={[styles.input, styles.mt8]} value={password} onChangeText={setPassword} placeholder="Contraseña (mínimo 8 caracteres)" placeholderTextColor={theme.textSecondary} secureTextEntry />

        {register && (
          <View style={styles.consent}>
            <TouchableOpacity onPress={() => setAccepted((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
              <MaterialCommunityIcons name={accepted ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={theme.primary} />
            </TouchableOpacity>
            <Text style={styles.consentTxt}>
              Autorizo el tratamiento de mis datos. Leer el{' '}
              <Text style={styles.link} onPress={() => setPrivacyOpen(true)}>aviso de privacidad</Text>
            </Text>
          </View>
        )}

        {!!msg && <Text style={[styles.msg, msg.ok ? styles.ok : styles.err]}>{msg.text}</Text>}

        <TouchableOpacity style={[styles.btn, !canSubmit && styles.btnOff]} disabled={!canSubmit} onPress={submit}>
          <Text style={styles.btnTxt}>{register ? 'Registrarme' : 'Entrar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setRegister((r) => !r); setMsg(null) }}>
          <Text style={styles.switch}>{register ? 'Ya tengo cuenta' : 'Crear una cuenta'}</Text>
        </TouchableOpacity>
      </View>
      <PrivacyScreen visible={privacyOpen} onClose={() => setPrivacyOpen(false)} lotName={null} />
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background, padding: 28, justifyContent: 'center' },
  close: { position: 'absolute', top: 48, right: 24 },
  title: { fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 18 },
  input: { backgroundColor: theme.onPrimary, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text },
  mt8: { marginTop: 8 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  consentTxt: { flex: 1, fontSize: 13, color: theme.text },
  link: { color: theme.primary, fontWeight: '800', textDecorationLine: 'underline' },
  msg: { fontSize: 13, fontWeight: '700', marginTop: 12 },
  ok: { color: theme.free },
  err: { color: theme.occupied },
  btn: { backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  btnOff: { opacity: 0.4 },
  btnTxt: { color: theme.onPrimary, fontSize: 15, fontWeight: '800' },
  switch: { color: theme.primary, fontWeight: '800', textAlign: 'center', marginTop: 16 },
})
