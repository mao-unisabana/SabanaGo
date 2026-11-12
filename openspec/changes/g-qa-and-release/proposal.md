# Proposal

## Why

La entrega del mar 17 nov exige reportar cada RF y RNF con su valor real (regla del `context.md`: las métricas no se maquillan) y cerrar los hitos de calidad, lanzamiento y legal (15 a 17 y 19 a 22). Las pruebas unitarias ya vienen dentro de cada cambio A a F; aquí van las verificaciones de punta a punta, las mediciones y lo mínimo de operación y protección de datos que falta.

## What Changes

- Verificación de integración en la nube: lista de seguridad de la nota 11 ejecutada contra el proyecto de demo.
- Medición de RNF-13 (error de detección) con video real etiquetado, de RNF-01 (latencia de punta a punta) y una prueba de carga reducida de RNF-10, todas con reporte del valor obtenido.
- QA de interfaz en Android e iOS (Expo Go) y contraste AA (RNF-06, RNF-15).
- Pantalla de aviso de privacidad y términos dentro de la app (hito 21) y canal de reporte de errores con el formulario de Cognito (hito 22).
- Respaldo de la base con `pg_dump` y una restauración probada en local (hito 20).
- Registro de errores de la app y de la detección (hito 19, versión mínima).
- PR `develop → main`, etiqueta `v1.0.0-mvp` y lista de evidencias para el Word final.

Fuera del alcance: CI/CD, dominio y HTTPS propio (Won't), analítica de producto con terceros y las pruebas con usuarios en sí, que hace el equipo con su propio guion (aquí solo se registran sus resultados).

## Capabilities

### New Capabilities
- `privacy-and-feedback`: cómo la app informa el tratamiento de datos y cómo el usuario reporta errores.

### Modified Capabilities

## Impact

- `apps/mobile/`: pantallas de privacidad y de reporte, `ErrorBoundary`.
- `scripts/`: `backup_db.sh`, `measure_latency.py`, `load_test.js` (k6).
- `supabase/tests/`: casos de integración que falten.
- Depende de: A a F. Es el último cambio antes de la entrega.
