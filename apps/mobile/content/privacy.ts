// Texto del aviso de privacidad y términos (hitos 21 y 22). Constante, no un .md.
export interface PrivacySection {
  title: string
  body: string
}

export const PRIVACY_TITLE = 'Privacidad y términos'

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: 'Qué datos guardamos',
    body: 'Solo guardamos tu correo electrónico (si creas una cuenta), tus favoritos y el estado de los puestos de parqueo (libre, ocupado o sin datos). No almacenamos imágenes ni video: las cámaras se procesan en el momento y solo se envía el estado de cada puesto.',
  },
  {
    title: 'Para qué los usamos',
    body: 'Tu correo se usa únicamente para tu cuenta, tus favoritos y los avisos de puesto libre que actives. No lo vendemos ni lo compartimos con terceros.',
  },
  {
    title: 'Tus derechos (Ley 1581 de 2012)',
    body: 'Conforme a la Ley 1581 de 2012 de protección de datos personales, puedes conocer, actualizar y rectificar tus datos, y solicitar su supresión. El tratamiento se hace con tu autorización, que das al crear la cuenta y puedes retirar cuando quieras.',
  },
  {
    title: 'Contacto y reclamos',
    body: 'Responsable: equipo SabanaGO, proyecto Capstone de la Universidad de La Sabana. Para consultas o reclamos escribe a mauriciosuba@unisabana.edu.co. Respondemos las consultas en 10 días hábiles y los reclamos en 15 días hábiles. Si no quedas conforme, puedes acudir a la Superintendencia de Industria y Comercio.',
  },
  {
    title: 'Borrar tu cuenta',
    body: 'Tienes derecho a borrar tu cuenta en cualquier momento desde Mi perfil, con la opción "Borrar mi cuenta". Se eliminan tu perfil y tus favoritos.',
  },
  {
    title: 'Términos de uso',
    body: 'La disponibilidad mostrada es informativa y puede diferir de la realidad por luz, ángulo de cámara o fallas de conexión; cuando la confianza es baja o la cámara no responde se muestra "sin datos". SabanaGo no reserva puestos ni se responsabiliza por decisiones tomadas con esta información.',
  },
]
