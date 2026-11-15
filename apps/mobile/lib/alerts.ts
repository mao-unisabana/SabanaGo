// Regla pura del aviso "se liberó un puesto" (nota 10, evaluada en el cliente).

export const ALERT_COOLDOWN_MS = 5 * 60 * 1000
// Bogotá es UTC-5 todo el año (sin horario de verano).
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000

export interface AlertInput {
  oldStatus?: string | null
  newStatus?: string | null
  notify: boolean
  /** 1 = lunes ... 7 = domingo; vacío o null = todos los días. */
  notifyDays?: number[] | null
  /** "HH:MM" o "HH:MM:SS" (columna time); null = a cualquier hora. */
  notifyTime?: string | null
  now: number
  /** Hora (ms) del último aviso de este favorito, si hubo. */
  lastNotifiedAt?: number | null
}

/** Día (1-7) y minutos desde medianoche en hora de Bogotá. */
function bogotaParts(now: number) {
  const d = new Date(now + BOGOTA_OFFSET_MS)
  return { day: d.getUTCDay() === 0 ? 7 : d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() }
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':')
  return Number(h) * 60 + Number(m)
}

export function shouldNotify(i: AlertInput): boolean {
  if (!i.notify) return false
  // Solo la transición a libre desde ocupado o sin datos.
  if (i.newStatus !== 'free' || i.oldStatus === 'free' || !i.oldStatus) return false
  const { day, minutes } = bogotaParts(i.now)
  if (i.notifyDays?.length && !i.notifyDays.includes(day)) return false
  if (i.notifyTime && minutes < timeToMinutes(i.notifyTime)) return false
  if (i.lastNotifiedAt != null && i.now - i.lastNotifiedAt < ALERT_COOLDOWN_MS) return false
  return true
}
