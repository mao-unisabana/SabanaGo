# Proposal

## Why

El prototipo móvil de Juan vive en el PR #1 (`feature/mobile-mapa-prototipo`) y `develop` solo tiene la estructura vacía. Sin integrarlo no hay base para conectar Supabase ni para la demo interna del 14 nov. Además, el prototipo todavía no cumple la guía visual v1.1 ni muestra el estado `no_data` que exige RF-08. Cierra parte de los hitos 06 (prototipo) y 12 (entorno).

## What Changes

- Revisar el PR #1 y corregir lo mínimo para que entre a `develop`: nombre SabanaGO, paleta v1.1, íconos vectoriales en lugar de emoji y dependencias con versión fija.
- Agregar el tercer estado de puesto, `no_data`, con su forma visual (gris con rayado) y la ✕ en ocupado, para que libre, ocupado y sin datos se distingan sin depender del color.
- Unificar los nombres de estado con el DER (`free`, `occupied`, `no_data`; hoy el prototipo usa `busy`).
- Volver a mostrar la atribución del mapa base y validar el ajuste a calles.
- Separar el modo administrador (herramientas de dibujo P02–P06) del modo conductor (vista P07 y contador) detrás de un interruptor simple, sin autenticación todavía.
- Mergear el PR #1 a `develop` con estas correcciones.

Fuera del alcance: conexión a Supabase (cambio D), autenticación (cambio E), versión web del mapa y panel admin RF-09.

## Capabilities

### New Capabilities
- `space-status-display`: cómo la app representa el estado de cada puesto y la ocupación total, con tres estados distinguibles por color y forma.

### Modified Capabilities

## Impact

- `apps/mobile/` completo: `App.tsx`, `components/Map.tsx`, `lib/lots.ts`, `package.json`, `app.json`.
- Nuevas dependencias: `@expo/vector-icons` (ya viene con Expo). Se fija `maplibre-gl` a una versión exacta dentro del HTML del WebView.
- Rama: `feature/a-integrate-mobile-prototype` creada desde `feature/mobile-mapa-prototipo`; el PR #1 se cierra a favor del nuevo PR, o se actualiza su rama.
