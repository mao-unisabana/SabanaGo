import { shouldNotify } from './alerts'

// 2026-11-15 es domingo.
const sundayNoon = Date.parse('2026-11-15T17:00:00Z') // 12:00 Bogotá
const base = { notify: true, oldStatus: 'occupied', newStatus: 'free', now: sundayNoon }

test('ocupado -> libre avisa', () => {
  expect(shouldNotify(base)).toBe(true)
})

test('no_data -> libre avisa', () => {
  expect(shouldNotify({ ...base, oldStatus: 'no_data' })).toBe(true)
})

test('libre -> ocupado no avisa', () => {
  expect(shouldNotify({ ...base, oldStatus: 'free', newStatus: 'occupied' })).toBe(false)
})

test('sin old.status no avisa', () => {
  expect(shouldNotify({ ...base, oldStatus: undefined })).toBe(false)
})

test('favorito con aviso apagado no avisa', () => {
  expect(shouldNotify({ ...base, notify: false })).toBe(false)
})

test('fuera de los días no avisa (sábado con aviso solo domingos)', () => {
  const saturday = Date.parse('2026-11-14T17:00:00Z')
  expect(shouldNotify({ ...base, now: saturday, notifyDays: [7], notifyTime: '11:00:00' })).toBe(false)
  expect(shouldNotify({ ...base, notifyDays: [7], notifyTime: '11:00:00' })).toBe(true)
})

test('antes de la hora no avisa, en hora de Bogotá', () => {
  // 15:30 UTC = 10:30 Bogotá
  const early = Date.parse('2026-11-15T15:30:00Z')
  expect(shouldNotify({ ...base, now: early, notifyTime: '11:00' })).toBe(false)
})

test('domingo cae en el día 7 incluso cerca de medianoche UTC', () => {
  // 2026-11-16T03:00Z = domingo 22:00 Bogotá
  expect(shouldNotify({ ...base, now: Date.parse('2026-11-16T03:00:00Z'), notifyDays: [7] })).toBe(true)
})

test('segundo aviso antes de 5 min no; después sí', () => {
  expect(shouldNotify({ ...base, lastNotifiedAt: sundayNoon - 60_000 })).toBe(false)
  expect(shouldNotify({ ...base, lastNotifiedAt: sundayNoon - 5 * 60_000 })).toBe(true)
})
