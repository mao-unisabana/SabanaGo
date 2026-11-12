# Design

## Context

La nota 08 fija Python 3.11, FastAPI, YOLOv8 y OpenCV en Docker. La nota 10 define la entrada: `rpc/ingest_space_states` con `{camera_id, states:[{space_id, status, confidence}]}`, cada 1 a 2 s, solo cambios y siempre latido. La base aplica el umbral de 0,7 y marca `no_data` a los 5 s sin latido (cambio B). Para la demo hay una maqueta con carritos de juguete, que un modelo COCO puede no reconocer como carros.

## Goals / Non-Goals

**Goals:**
- Un proceso por cámara, simple de levantar y de detener en la demo.
- Lógica de decisión separada de la entrada de video y de la salida a Supabase, para probarla con pytest sin cámara.

**Non-Goals:**
- API HTTP pública: el servicio no expone nada a la app (RNF-11). FastAPI se usa solo para `/health` dentro de la red de Docker.
- Seguimiento de vehículos, lectura de placas o GPU.

## Decisions

1. **Estructura del paquete** `services/detection/sabanago_detection/`:
   - `config.py`: variables de entorno con valores por defecto.
   - `source.py`: abre `webcam:<n>`, ruta de archivo (en bucle) o `rtsp://`; reintenta cada 2 s.
   - `detectors/yolo.py` y `detectors/diff.py` con una interfaz común `detect(frame, spaces) -> dict[space_id, (status, confidence)]`.
   - `smoothing.py`: ventana de 3 cuadros por puesto, voto de mayoría.
   - `ingest.py`: cliente HTTP (`httpx`) a la RPC con la llave de servicio; envía solo cambios y latido cada `INGEST_INTERVAL_S` (1,5 s por defecto).
   - `main.py`: bucle principal y `/health`.
   - `tools/measure_accuracy.py`: compara la salida del detector con un CSV etiquetado a mano.
2. **YOLO**: `yolov8n.pt` de Ultralytics, clases COCO de vehículo (car 2, motorcycle 3, bus 5, truck 7), `conf ≥ 0.25` para candidatas. Ocupación = área de intersección caja–polígono ÷ área del polígono (con `shapely`); ≥ 0,30 → `occupied` con la confianza de la caja; si no hay caja → `free` con confianza `1 − max(conf de cajas que tocan el polígono)` o 0,95 si no toca ninguna. Se analiza 1 cuadro por segundo, lo que basta para la meta de 5 s y corre en CPU.
3. **Diff (maqueta)**: al arrancar, o con `--capture-reference`, guarda una imagen del parqueadero vacío en `data/reference/<camera_id>.png`, la única imagen permitida. Por puesto calcula la diferencia media absoluta en escala de grises dentro del polígono (máscara); por encima del umbral `DIFF_THRESHOLD` → `occupied`. Confianza = distancia normalizada al umbral, recortada a [0,5; 1].
4. **Puestos desde la base**: al arrancar y cada 60 s lee `space?camera_id=eq.{id}&is_active=eq.true&select=id,code,image_polygon` con la llave de servicio. Así la calibración del cambio F se aplica sin reiniciar.
5. **Docker**: `python:3.11-slim` + `libgl1` y `libglib2.0-0` para OpenCV; el modelo se descarga en el build para no depender de red en la demo. Para webcam en Linux se monta `/dev/video0`; en Windows, Docker no ve la webcam, así que la demo con maqueta corre el mismo paquete con `python -m sabanago_detection` en un entorno virtual (desviación documentada de RNF-16 solo para la webcam).

## Risks / Trade-offs

- [YOLO no reconoce carritos de juguete] → Por eso existe `diff`; la precisión de RNF-13 se mide con YOLO sobre video real del parqueadero, no con la maqueta, y se reporta tal cual.
- [Cambios de luz rompen `diff`] → Volver a capturar la referencia antes de la demo (tarea del cambio F).
- [CPU lenta en el portátil de la demo] → 1 cuadro por segundo y `yolov8n`; medir el tiempo por cuadro en la tarea 3.3.
- [Webcam no visible desde Docker en Windows] → Ejecución nativa con el mismo código y variables.

## Migration Plan

1. Probar con un video grabado (`VIDEO_SOURCE=data/videos/alejandria.mp4`) contra Supabase local.
2. Pasar a la nube cambiando solo `.env`.
3. Rollback: detener el contenedor; la base pasa sola los puestos a `no_data`.
