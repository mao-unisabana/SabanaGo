# Tasks

Hitos de Obsidian: 15, 16, 17 (calidad), 19, 20 (lanzamiento), 21, 22 (legal) y 23 (evidencias de costos si cambian). Fechas: dom 15 y lun 16 nov 2026; entrega mar 17. Requiere A a F mergeados.

## 1. Privacidad y reporte (antes del congelamiento)

- [ ] 1.1 Crear `feature/g-qa-and-release`, la pantalla "Privacidad y términos" con el texto en `content/privacy.ts` y enlazarla desde el registro y el menú; verificación: se abre desde ambos lugares y el registro conserva lo escrito
- [ ] 1.2 Agregar "Reportar un problema" con `EXPO_PUBLIC_FEEDBACK_URL` y parámetros prellenados, y el `ErrorBoundary` con reintentar y reportar; verificación: un error forzado en desarrollo muestra la pantalla de recuperación y el formulario abre con la versión y el parqueadero

## 2. Mediciones

- [ ] 2.1 Etiquetar 100 cuadros del video real y correr `measure_accuracy.py` con YOLO; verificación: exactitud, error y matriz anotados en la tabla de evidencias del PR
- [ ] 2.2 Escribir y correr `scripts/measure_latency.py` (50 cambios, mediana y p95) y medir el pintado en el celular con video en 10 casos; verificación: valores anotados en la tabla de evidencias
- [ ] 2.3 Escribir y correr `scripts/load_test.js` con k6 (50 usuarios, 1 min) contra la demo; verificación: p95 y tasa de error anotados como prueba reducida de RNF-10

## 3. Seguridad y QA de interfaz

- [ ] 3.1 Repetir contra la nube los casos de seguridad de la nota 11 (anon, usuario, admin, `source_url`, TLS, llave de servicio fuera del repo); verificación: cada caso con su resultado en la tabla de evidencias
- [ ] 3.2 QA de interfaz en un Android y un iOS con Expo Go (C01–C06, modo administrador) y revisión de contraste AA; verificación: lista de pantallas probadas y defectos abiertos como `fix/<tema>`

## 4. Operación

- [ ] 4.1 Escribir `scripts/backup_db.sh`, sacar un respaldo de la demo y restaurarlo en local; verificación: `get_occupancy` en local devuelve los mismos totales que la nube

## 5. Entrega

- [ ] 5.1 Revisar todo con `code-review-graph`, abrir PR `develop → main` con la tabla de evidencias (meta, valor obtenido, cómo se midió) y, tras aprobarlo, etiquetar `v1.0.0-mvp`; verificación: `main` contiene la etiqueta y la app de la demo corre desde `main`

## Workflow follow-up

- Archivar `g-qa-and-release` tras el merge a `main`.
- Pasar a Mao la tabla de evidencias para actualizar las notas 15 a 22 y el Word final.
- Las pruebas con usuarios (RNF-05, mínimo 8 personas el 15 y 16 nov) las hace el equipo; sus resultados se agregan a la misma tabla.
