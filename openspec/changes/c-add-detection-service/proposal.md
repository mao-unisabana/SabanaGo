# Proposal

## Why

La pieza "SabanaGO Mira" del pitch no existe: `services/detection/` está vacío. Sin ella la app solo mostraría datos de prueba y no se cumple RF-01 ni RF-08, que son Must. Cierra la parte de detección del hito 13 y el `Dockerfile` del paso 5 del hito 12.

## What Changes

- Servicio Python 3.11 en `services/detection/` que lee una fuente de video (webcam, archivo o RTSP), decide el estado de cada puesto y lo envía a Supabase con `ingest_space_states` cada 1 a 2 segundos.
- Dos detectores intercambiables por variable de entorno: `yolo` (YOLOv8n sobre carros reales) y `diff` (diferencia contra una imagen del puesto vacío, pensado para la maqueta con carritos).
- Suavizado temporal para que un puesto no parpadee entre estados.
- Latido aunque no cambie nada, y estado `no_data` cuando la confianza es baja o la fuente se cae.
- Imagen Docker y `docker-compose.yml` para levantarlo igual en local y en la demo (RNF-16).
- Script de medición del error de detección contra puestos etiquetados a mano (meta RNF-13: error ≤ 5 %).

Fuera del alcance: herramienta de calibración de polígonos (cambio F), procesamiento en GPU y varias cámaras en paralelo en un mismo proceso.

## Capabilities

### New Capabilities
- `space-detection`: cómo se convierte la imagen de una cámara en el estado de cada puesto que esa cámara cubre, y qué pasa cuando la imagen no alcanza.

### Modified Capabilities

## Impact

- Carpeta `services/detection/` nueva: código, pruebas, `Dockerfile`, `requirements.txt`.
- `docker-compose.yml` en la raíz.
- `.env.example`: `CAMERA_ID`, `VIDEO_SOURCE`, `DETECTOR`, `CONFIDENCE_THRESHOLD`, `INGEST_INTERVAL_S`.
- Depende de: B (RPC de ingesta y tabla `space` con `image_polygon`).
