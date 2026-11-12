# Tasks

Hitos de Obsidian: 13 (RF-01, RF-08) y 12 (paso 5, Dockerfile). Fecha objetivo: vie 13 nov 2026. Requiere el cambio B mergeado o corriendo en local.

## 1. Esqueleto

- [ ] 1.1 Crear `feature/c-add-detection-service`, el paquete `services/detection/sabanago_detection/` con `config.py`, `requirements.txt` con versiones exactas (`ultralytics`, `opencv-python-headless`, `shapely`, `httpx`, `fastapi`, `uvicorn`, `pytest`) y agregar las variables nuevas a `.env.example`; verificación: `python -c "import sabanago_detection"` funciona en un venv limpio
- [ ] 1.2 Implementar `source.py` (webcam, archivo en bucle, RTSP, reintento cada 2 s); verificación: prueba pytest con un video corto generado en la prueba que confirma la lectura y el bucle

## 2. Decisión por puesto

- [ ] 2.1 Implementar el cálculo de cobertura caja–polígono y `detectors/yolo.py`; pruebas pytest con cajas sintéticas: 30 % → `occupied`, 10 % → `free`, puesto sin polígono omitido; verificación: `pytest` pasa
- [ ] 2.2 Implementar `detectors/diff.py` con captura de referencia; pruebas con imágenes sintéticas (puesto vacío vs. rectángulo pintado); verificación: `pytest` pasa
- [ ] 2.3 Implementar `smoothing.py` con voto de 3 cuadros; prueba de un cuadro aislado que no cambia el estado; verificación: `pytest` pasa

## 3. Salida a Supabase

- [ ] 3.1 Implementar `ingest.py` (solo cambios, latido cada 1,5 s, lectura de puestos cada 60 s); prueba con un servidor HTTP falso que cuenta lotes: ≥ 5 lotes en 10 s sin cambios; verificación: `pytest` pasa
- [ ] 3.2 Implementar `main.py` con el bucle a 1 cuadro por segundo, `/health` y logs en JSON por línea (cámara, puestos enviados, tiempo por cuadro, errores); verificación: correr contra Supabase local con un video y ver los estados cambiar en `space_state`
- [ ] 3.3 Medir el tiempo por cuadro de YOLO en el portátil de la demo y registrarlo en el PR; verificación: valor anotado en la descripción del PR

## 4. Contenedor y medición

- [ ] 4.1 Escribir `Dockerfile` y `docker-compose.yml` (servicio `detection` con `env_file: .env`); verificación: `docker compose up detection` envía lotes a Supabase local
- [ ] 4.2 Escribir `tools/measure_accuracy.py` que lea un CSV `frame,space_code,label`, corra el detector y reporte el error en % y la matriz libre/ocupado; verificación: prueba con un CSV pequeño de ejemplo
- [ ] 4.3 Confirmar que no se escriben imágenes (salvo la referencia de `diff`) buscando archivos nuevos tras 5 minutos de ejecución; revisar con `code-review-graph` y abrir PR a `develop`; verificación: PR abierto con `pytest` en verde

## Workflow follow-up

- Tras el merge: `openspec archive c-add-detection-service` y resumen a Mao para las notas 12 (paso 5) y 13.
