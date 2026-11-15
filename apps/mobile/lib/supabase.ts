import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

// ponytail: sin validación dura de env; sin llaves el cliente falla al primer fetch
// y los hooks caen a caché/error. Para la demo basta con el aviso en consola.
if (__DEV__ && (!url || !anonKey)) {
  console.warn('[supabase] faltan EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY (ver .env.example)')
}

export const supabase = createClient(url, anonKey, {
  auth: { storage: AsyncStorage, persistSession: true, detectSessionInUrl: false },
})
