import app from '../app.json'

/** Versión de la app mostrada en el reporte. */
export const APP_VERSION: string = app.expo.version

/**
 * Arma la URL del formulario de reporte con la versión y el parqueadero prellenados.
 * Devuelve null si no hay URL configurada o no es válida.
 */
export function buildFeedbackUrl(base: string | undefined, version: string, lotName: string | null): string | null {
  if (!base) return null
  try {
    const url = new URL(base)
    url.searchParams.set('version', version)
    url.searchParams.set('parqueadero', lotName ?? 'ninguno')
    // Cognito Forms prellena con ?entry={"Campo":"valor"}; los campos del formulario se llaman Version y Parqueadero.
    url.searchParams.set('entry', JSON.stringify({ Version: version, Parqueadero: lotName ?? 'ninguno' }))
    return url.toString()
  } catch {
    return null
  }
}

/** URL de reporte con la variable de entorno de la app. */
export function feedbackUrl(lotName: string | null): string | null {
  return buildFeedbackUrl(process.env.EXPO_PUBLIC_FEEDBACK_URL, APP_VERSION, lotName)
}
