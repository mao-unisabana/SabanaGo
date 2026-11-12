# Design

## Context

Metas a reportar (notas 15, 16, 17 y requisitos): RF-01 ≥ 95 % de clasificación correcta con 100 imágenes, RNF-13 error ≤ 5 %, RF-08 confianza < 0,7 → `no_data`, RNF-04 401/403, RNF-01 latencia ≤ 5 s en el 95 %, RNF-02 mapa ≤ 3 s en 4G, RNF-06 contraste AA, RNF-15 Android e iOS en las dos últimas versiones mayores, RNF-10 500 usuarios concurrentes con respuesta ≤ 3 s en el 95 %. El congelamiento es el dom 15 nov: desde ahí solo entran ramas `fix/`.

## Goals / Non-Goals

**Goals:**
- Una tabla de evidencias con valor obtenido, meta y cómo se midió, lista para el Word final.

**Non-Goals:**
- Escalar la infraestructura para pasar RNF-10 si no se cumple: se reporta el valor y la causa.

## Decisions

1. **Precisión (RF-01, RNF-13)**: 100 cuadros del video real (o del plan B) etiquetados a mano en un CSV `frame,space_code,label`; se corre `tools/measure_accuracy.py` del cambio C con `DETECTOR=yolo`. Se reporta exactitud, error y la matriz libre/ocupado.
2. **Latencia (RNF-01)**: `scripts/measure_latency.py` hace 50 cambios con la ingesta y mide, en el mismo portátil, el tiempo hasta recibir el evento Realtime por un cliente Python suscrito a la zona. Se reporta mediana y percentil 95. Mide base + Realtime; el pintado en el celular se mide aparte con cronómetro en video a 60 fps en 10 casos.
3. **Carga (RNF-10)**: k6 con 50 usuarios virtuales durante 1 minuto contra `rpc/get_occupancy` y el endpoint 1 en el proyecto de demo (plan gratuito), no 500, para no saturar ni violar los términos del plan. Se reporta como prueba reducida y se proyecta con cuidado; queda declarado como limitación.
4. **Seguridad**: los casos de la nota 11 corren con `supabase test db` en local y se repiten contra la nube con `curl` (anon, usuario, admin); se verifica TLS 1.2+ con `curl -v --tlsv1.1 --tls-max 1.1` (debe fallar) y que la `service_role` no esté en el historial (`git log -p | grep` del prefijo de la llave).
5. **Privacidad y reporte**: texto del aviso como constante en `apps/mobile/content/privacy.ts` (no un `.md`); el reporte abre el formulario de Cognito con `Linking.openURL` y parámetros prellenados (`EXPO_PUBLIC_FEEDBACK_URL`).
6. **Respaldo (hito 20)**: `scripts/backup_db.sh` con `pg_dump --format=custom` usando la cadena de conexión de la demo; restauración probada en la base local con `pg_restore`. Respaldo manual diario durante el piloto.
7. **Registro (hito 19)**: la detección ya escribe logs JSON (cambio C); la app agrega `ErrorBoundary` y registra errores en consola. El monitoreo de disponibilidad se hace con la vista `camera_status` y los logs de Supabase; analítica de producto queda fuera.
8. **Entrega**: PR `develop → main` revisado con `code-review-graph` y `commit-orchestrator`, etiqueta `v1.0.0-mvp`.

## Risks / Trade-offs

- [Error de detección mayor a 5 %] → Se reporta tal cual con la causa (luz, ángulo, oclusión) y el estado `no_data` como mitigación; no se cambia la meta.
- [Poco tiempo entre congelamiento y entrega] → Las mediciones corren el dom 15 y lun 16 en paralelo con el respaldo y el ensayo.
- [k6 contra el plan gratuito activa límites] → Prueba corta y en horario fuera de la demo.

## Migration Plan

1. Mediciones y QA sobre `develop` congelado.
2. Correcciones solo por ramas `fix/<tema>`.
3. Merge a `main` el lun 16 en la noche y etiqueta.
