// RNF-10 (prueba reducida): 50 usuarios virtuales durante 1 minuto con lectura anónima.
// Uso: k6 run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... [-e LOT_ID=1] scripts/load_test.js
// Las llaves vienen del entorno; el script no las imprime.
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE = __ENV.SUPABASE_URL
const ANON = __ENV.SUPABASE_ANON_KEY
const LOT_ID = Number(__ENV.LOT_ID || 1)

if (!BASE || !ANON) {
  throw new Error('Faltan SUPABASE_URL y SUPABASE_ANON_KEY en el entorno')
}

export const options = {
  vus: 50,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<3000'], // meta: respuesta <= 3 s en el 95 %
    http_req_failed: ['rate<0.01'],
  },
}

const headers = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }

export default function () {
  const occ = http.post(`${BASE}/rest/v1/rpc/get_occupancy`, JSON.stringify({ lot_id: LOT_ID }), { headers })
  check(occ, { 'get_occupancy 200': (r) => r.status === 200 })

  const spaces = http.get(`${BASE}/rest/v1/space?select=id,code,zone_id&limit=100`, { headers })
  check(spaces, { 'space 200': (r) => r.status === 200 })

  sleep(1)
}
