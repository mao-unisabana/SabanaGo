import { Component, type ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { theme } from '../lib/theme'
import { reportProblem } from './PrivacyScreen'

/** Captura errores de render: muestra pantalla de recuperación con reintentar y reportar. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Algo salió mal</Text>
        <Text style={styles.msg}>La app tuvo un error inesperado. Puedes reintentar o reportarlo.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => this.setState({ failed: false })}>
          <Text style={styles.btnTxt}>Reintentar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outline} onPress={() => reportProblem(null)}>
          <Text style={styles.outlineTxt}>Reportar un problema</Text>
        </TouchableOpacity>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background, justifyContent: 'center', padding: 28 },
  title: { fontSize: 22, fontWeight: '800', color: theme.text },
  msg: { fontSize: 14, color: theme.textSecondary, marginTop: 8 },
  btn: { backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  btnTxt: { color: theme.onPrimary, fontSize: 15, fontWeight: '800' },
  outline: { borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  outlineTxt: { fontWeight: '800', color: theme.text },
})
