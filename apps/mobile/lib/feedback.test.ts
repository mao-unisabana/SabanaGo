import { buildFeedbackUrl } from './feedback'

describe('buildFeedbackUrl', () => {
  it('agrega versión y parqueadero', () => {
    const u = new URL(buildFeedbackUrl('https://forms.example.com/f', '1.0.0', 'Parqueadero A')!)
    expect(u.searchParams.get('version')).toBe('1.0.0')
    expect(u.searchParams.get('parqueadero')).toBe('Parqueadero A')
  })

  it('conserva parámetros existentes y usa "ninguno" sin parqueadero', () => {
    const u = new URL(buildFeedbackUrl('https://forms.example.com/f?x=1', '1.0.0', null)!)
    expect(u.searchParams.get('x')).toBe('1')
    expect(u.searchParams.get('parqueadero')).toBe('ninguno')
  })

  it('devuelve null sin URL o con URL inválida', () => {
    expect(buildFeedbackUrl(undefined, '1.0.0', null)).toBeNull()
    expect(buildFeedbackUrl('', '1.0.0', null)).toBeNull()
    expect(buildFeedbackUrl('no es url', '1.0.0', null)).toBeNull()
  })
})
