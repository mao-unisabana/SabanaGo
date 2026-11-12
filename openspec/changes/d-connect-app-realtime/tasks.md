# Tasks

Hito de Obsidian: 13 (RF-02, RF-03, RF-04, RF-10). Fecha objetivo: vie 13 nov 2026. Requiere A y B mergeados.

## 1. Cliente y datos

- [ ] 1.1 Crear `feature/d-connect-app-realtime`, instalar `@supabase/supabase-js` y `react-native-url-polyfill` con versión exacta, crear `lib/supabase.ts` y `apps/mobile/.env.example` con `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`; verificación: la app arranca en Expo Go y una consulta a `parking_lot` devuelve los 2 parqueaderos del seed
- [ ] 1.2 Crear `lib/api.ts` con las consultas de los endpoints 1 a 4 y el mapeo a `SpotFeature` y `Lot`; prueba unitaria del mapeo con una fila de ejemplo (polígono abierto se cierra, `status` correcto, puesto sin estado → `no_data`); verificación: la prueba pasa

## 2. Pantalla del conductor

- [ ] 2.1 Reemplazar AsyncStorage como fuente de parqueaderos por `useLotData` (carga, error y recarga) y mostrar el selector de parqueadero y el filtro por zona; verificación: en Expo Go se ven Alejandría y la Maqueta y el contador cambia al elegir zona
- [ ] 2.2 Implementar `useLiveSpaces(zoneId)` con el canal Realtime, recarga al abrir, al volver a primer plano y al reconectar, y espera creciente ante errores; verificación: con `curl` a la ingesta en local, el puesto cambia en Expo Go en menos de 5 s
- [ ] 2.3 Agregar el indicador "En vivo · hace N s" y el caché del último estado con su antigüedad; verificación: con el modo avión activado la app muestra el último estado y "Última actualización hace N min"
- [ ] 2.4 Consultar `camera_status` cada 10 s y mostrar "Cámara sin señal"; verificación: al detener la ingesta, en menos de 10 s aparece el aviso y los puestos quedan en gris

## 3. Modo administrador contra la base

- [ ] 3.1 Cambiar crear, editar y borrar puestos para que usen `admin_upsert_space` y `admin_delete_space` con una sesión iniciada desde un formulario mínimo de correo y contraseña al entrar al modo administrador (sin credenciales en el código), y mostrar el error si la RPC responde 401 o 403; verificación: un puesto dibujado aparece en `space` y, con un usuario sin rol admin, la app muestra el 403

## 4. Entrega

- [ ] 4.1 Registrar en consola la latencia de cada evento en modo desarrollo; revisar con `ui-ux-designer` la pantalla del conductor contra C01–C02 del documento v1.1; correr `npm run typecheck` y pruebas, revisar con `code-review-graph` y abrir PR a `develop`; verificación: PR abierto con checks en verde

## Workflow follow-up

- Tras el merge: `openspec archive d-connect-app-realtime` y resumen a Mao para la nota 13.
