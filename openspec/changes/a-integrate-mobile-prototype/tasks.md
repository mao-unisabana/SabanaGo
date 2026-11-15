# Tasks

Hitos de Obsidian: 06 (prototipo) y 12 (entorno). Fecha objetivo: jue 12 nov 2026.

## 1. Preparar la rama

- [x] 1.1 Crear `feature/a-integrate-mobile-prototype` desde `origin/feature/mobile-mapa-prototipo`, correr `npm ci` en `apps/mobile` y confirmar que `npm run typecheck` pasa antes de tocar nada
- [x] 1.2 Revisar el diff del PR #1 con `adversarial-code-reviewer` y anotar en el PR los hallazgos que no cubran las tareas de este cambio; verificación: comentario publicado en el PR

## 2. Identidad v1.1

- [x] 2.1 Renombrar el paquete y la app a SabanaGO (`package.json` name `sabanago-mobile`, `app.json` name y slug); verificación: `grep -ri parqueo apps/mobile --exclude-dir=node_modules` no devuelve nada
- [x] 2.2 Crear `apps/mobile/lib/theme.ts` con los tokens de la paleta v1.1 (primario, primario claro, libre, relleno libre, ocupado, sin datos, carril, fondo, superficie, texto, texto secundario, borde) y reemplazar todos los colores sueltos de `App.tsx` y `Map.tsx`; verificación: no quedan #2F9E6F, #D7483F ni #8C856F en el código
- [x] 2.3 Cambiar emoji y símbolos (🚗, ＋, ✓) por `MaterialCommunityIcons` de `@expo/vector-icons` en React Native; dentro del WebView, el marcador del usuario pasa a un círculo SVG; verificación: inspección visual en Expo Go

## 3. Tres estados de puesto

- [x] 3.1 Cambiar `SpotFeature.properties.state` por `status: 'free' | 'occupied' | 'no_data'` en `Map.tsx`, `lots.ts` y `App.tsx`, y migrar al leer de AsyncStorage los valores `busy` a `occupied`; verificación: `npm run typecheck` pasa y un parqueadero guardado antes sigue cargando
- [x] 3.2 Pintar `no_data` con `fill-pattern` de rayas y `occupied` con una capa `symbol` ✕ blanca en el centroide; verificación: captura en Expo Go con un puesto de cada estado
- [x] 3.3 Cambiar `countsOf` para devolver libres, ocupados, sin datos y total, y mostrar el contador de 4 columnas; agregar una prueba unitaria de `countsOf` con 5/6/1/12 (instalar `jest-expo` si no hay runner); verificación: la prueba pasa

## 4. Mapa base y dependencias

- [x] 4.1 Fijar `maplibre-gl` a una versión 5.x exacta en el `<script>` y el `<link>` del HTML del WebView; verificación: el HTML no contiene `@5/`
- [x] 4.2 Activar la atribución (`attributionControl: { compact: true }`) y conservar la consulta a la fuente `protomaps` del estilo CARTO; verificación: la atribución aparece y la consola del WebView no muestra errores al trazar un carril

## 5. Modos y entrega

- [x] 5.1 Agregar el interruptor conductor / administrador en la barra superior; en modo conductor se ocultan las herramientas de dibujo y el FAB de nuevo parqueadero; verificación: recorrido manual en Expo Go de ambos modos
- [x] 5.2 Correr `npm run typecheck` y las pruebas, revisar con `code-review-graph`, abrir PR a `develop` que referencie y reemplace al PR #1 y pedir revisión a Juan; verificación: PR abierto con checks en verde

## Workflow follow-up

- Tras el merge: cerrar el PR #1 con enlace al nuevo PR, archivar el cambio con `openspec archive a-integrate-mobile-prototype` y pasarle a Mao el resumen para las notas 06 y 12.
