# Design

## Context

El prototipo (PR #1) es una app Expo SDK 58 con un mapa MapLibre GL dentro de un WebView (`components/Map.tsx`), estilo vectorial Voyager de CARTO, y guarda los parqueaderos en AsyncStorage (`App.tsx`, `lib/lots.ts`). Los puestos son polígonos `[lng, lat]`, el mismo formato que `space.map_polygon` del DER v1.1. Compila con `tsc --noEmit`.

Problemas encontrados al revisarlo (11 nov):
- Estados `free` / `busy`, sin `no_data`.
- Colores de la identidad anterior (#2F9E6F, #D7483F) y emoji (🚗, ＋, ✓).
- `maplibre-gl@5` sin versión exacta, cargado desde unpkg.
- `querySourceFeatures('protomaps', …)` apunta a una fuente que el estilo de CARTO no tiene, así que el ajuste a calles nunca funciona.
- `attributionControl: false` oculta la atribución que exige OpenStreetMap.
- Nombre del paquete `parqueo`.

## Goals / Non-Goals

**Goals:**
- Dejar en `develop` una app que compile, use la identidad v1.1 y muestre los tres estados.
- Conservar las herramientas de dibujo, que sirven para cargar el plano de Alejandría y la maqueta.

**Non-Goals:**
- Conectar a Supabase o quitar AsyncStorage (cambio D).
- Versión web: el WebView no corre en Expo web. La demo y las pruebas van en Expo Go (decisión registrada en la nota 12).
- Panel admin RF-09.

## Decisions

1. **Se conserva MapLibre en WebView.** Desviación respecto al `context.md`, que menciona `react-native-svg`. Las herramientas de dibujo ya funcionan sobre coordenadas reales y rehacerlas en SVG no cabe antes del 14 nov. Alternativa descartada: plano SVG proyectado, que sí correría en web pero obliga a reescribir el dibujo.
2. **Rayado de `no_data` con `fill-pattern`.** Se registra una imagen de rayas con `map.addImage` al cargar el estilo y la capa usa `fill-pattern` para `no_data`. La ✕ de ocupado es una capa `symbol` con `text-field: '✕'` sobre el centroide del puesto; usa las glifos del estilo de CARTO.
3. **Estado como propiedad `status`.** `SpotFeature.properties.state` pasa a `status: 'free' | 'occupied' | 'no_data'`, alineado con el enum `space_status`. Los datos viejos en AsyncStorage con `busy` se migran a `occupied` al leerlos.
4. **Carriles sin dependencia de una fuente inexistente.** Se elimina la consulta a `protomaps` y el ajuste a calles queda deshabilitado. El trazado manual de carriles (P06) sigue funcionando.
5. **Modo por interruptor local.** Un `useState<'driver' | 'admin'>` con un botón en la barra superior. La protección real del modo admin llega con roles en el cambio E y RF-09; aquí solo se separa la interfaz.
6. **Versión fija de MapLibre.** `maplibre-gl@5.x.y` exacta, la última 5.x disponible al implementar, en el `<script>` y el `<link>` del HTML.

## Risks / Trade-offs

- [El rayado con `fill-pattern` se ve mal en pantallas pequeñas] → Probarlo en Expo Go Android; si no se lee, usar gris con borde punteado y documentar el cambio en el PR.
- [Juan sigue trabajando en su rama] → Avisarle antes de tomar la rama; los cambios se hacen sobre una copia (`feature/a-integrate-mobile-prototype`).
- [La ✕ depende de las glifos del estilo remoto] → Si no cargan, la capa `symbol` falla en silencio: verificarlo con el WebView sin caché.

## Migration Plan

1. Crear `feature/a-integrate-mobile-prototype` desde `origin/feature/mobile-mapa-prototipo`.
2. Aplicar las tareas y abrir PR a `develop` que reemplace al PR #1 (cerrar el #1 con un comentario que enlace el nuevo).
3. Rollback: revertir el merge en `develop`; la rama de Juan queda intacta.
