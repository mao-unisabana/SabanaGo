import { filterLots, lotState, normalizeText, type PickerItem } from './lotPicker'

const occ = (free: number, occupied: number, no_data: number) => ({ free, occupied, no_data, total: free + occupied + no_data })
const item = (id: string, name: string, o: PickerItem['occ'], favorite = false): PickerItem => ({ id, name, zones: 1, occ: o, favorite })

const items = [
  item('1', 'Cafetería Norte', occ(3, 5, 0), true),
  item('2', 'Biblioteca', occ(0, 8, 0)),
  item('3', 'Ingeniería', occ(0, 0, 4)),
  item('4', 'Sin carga', null),
]

describe('normalizeText', () => {
  it('quita tildes, mayúsculas y espacios', () => {
    expect(normalizeText('  CafeTería ')).toBe('cafeteria')
  })
})

describe('lotState', () => {
  it('clasifica libre, lleno y sin datos', () => {
    expect(lotState(occ(1, 1, 0))).toBe('free')
    expect(lotState(occ(0, 2, 0))).toBe('full')
    expect(lotState(occ(0, 0, 3))).toBe('no_data')
    expect(lotState(occ(0, 0, 0))).toBe('no_data')
    expect(lotState(null)).toBe('no_data')
  })
})

describe('filterLots', () => {
  it('busca ignorando diacríticos y mayúsculas', () => {
    expect(filterLots(items, 'CAFETERIA', 'all').map((i) => i.id)).toEqual(['1'])
    expect(filterLots(items, 'ingenieria', 'all').map((i) => i.id)).toEqual(['3'])
  })
  it('"Con cupos" exige libres > 0', () => {
    expect(filterLots(items, '', 'free').map((i) => i.id)).toEqual(['1'])
  })
  it('"Favoritos" solo favoritos', () => {
    expect(filterLots(items, '', 'favorites').map((i) => i.id)).toEqual(['1'])
  })
  it('combina búsqueda y filtro; vacío si nada coincide', () => {
    expect(filterLots(items, 'biblio', 'free')).toEqual([])
    expect(filterLots(items, '', 'all')).toHaveLength(4)
  })
})
