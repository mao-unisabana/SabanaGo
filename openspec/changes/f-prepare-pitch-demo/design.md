# Design

## Context

Guion del pitch (doc "Pitch híbrido SabanaGO", escenas 5a a 5c): Felipe pone un carrito en un puesto de la maqueta con la cámara arriba; Juan muestra en el celular proyectado que el puesto pasa a rojo en menos de 5 s; luego Felipe lo quita y llega el aviso a la cuenta de "Doña Carmen". El seed del cambio B crea el parqueadero "Maqueta demo" con 6 puestos y una cámara `webcam:0`. El detector `diff` del cambio C es el indicado para carritos de juguete.

## Goals / Non-Goals

**Goals:**
- Calibrar la maqueta en menos de 5 minutos.
- Ensayar la secuencia completa 5 veces seguidas sin intervención manual en la base.

**Non-Goals:**
- Interfaz gráfica en la app para calibrar (se hace en el portátil con OpenCV).

## Decisions

1. **Calibración con OpenCV** (`tools/calibrate.py --camera-id N`): abre la fuente de la cámara, congela un cuadro y, para cada puesto de la cámara (en orden de `code`), pide 4 clics; `u` deshace, `s` guarda, `n` salta. Guarda con un `PATCH` a `space` usando la llave de servicio, y además una copia en `data/calibration/<camera_id>.json` para restaurar rápido. Los puestos se leen de la base, así que no se crean puestos aquí.
2. **Referencia** (`tools/capture_reference.py`): promedia 10 cuadros para bajar ruido; si el brillo medio está fuera de [40, 220] sobre 255, advierte y no guarda.
3. **Reinicio** (`tools/demo_reset.py --lot "Maqueta demo"`): llama a `ingest_space_states` con todos los puestos de la cámara en `free` y confianza 1, lo que también marca la cámara en línea. Borra en AsyncStorage del celular la espera de 5 min del aviso desde un botón oculto del perfil (pulsación larga en la versión), solo en desarrollo.
4. **Maqueta**: base de cartón de unos 60 × 40 cm con 6 puestos marcados con cinta de color contrastante, webcam en un soporte a ~50 cm de altura mirando hacia abajo, luz fija (lámpara) para no depender de la del salón.
5. **Proyección**: `scrcpy` para Android por USB (sin depender del wifi del salón); en iPhone, QuickTime por cable en un Mac. El portátil de la demo corre la detección nativa (ver cambio C, Windows sin acceso a la webcam desde Docker).
6. **Red**: hotspot propio del celular como red del portátil; la Supabase en la nube es la única dependencia externa.
7. **Respaldo**: grabar con el teléfono y con captura de pantalla (scrcpy `--record`) las escenas 5a, 5b y 5c el lun 16, e insertarlas en las diapositivas.

## Risks / Trade-offs

- [El detector `diff` confunde sombras de las manos con carros] → El suavizado de 3 cuadros del cambio C y retirar la mano antes de 1 s; se ensaya.
- [Supabase pausado o lento el día de la entrega] → Abrir la app 30 min antes; si falla, video de respaldo.
- [Batería del celular] → Cable conectado durante toda la presentación.

## Migration Plan

1. Montar la maqueta y calibrar el sáb 14 en la mañana para la demo interna.
2. Volver a capturar la referencia en el salón el día de la entrega.
3. Rollback: video de respaldo.
