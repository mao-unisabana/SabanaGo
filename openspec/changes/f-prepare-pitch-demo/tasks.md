# Tasks

Hito de Obsidian: 18 (entorno de demo) y demo interna. Fechas: sáb 14 nov 2026 (demo interna) y lun 16 nov (respaldo y ensayo). Requiere B, C, D y E.

## 1. Herramientas

- [ ] 1.1 Crear `feature/f-prepare-pitch-demo` e implementar `tools/calibrate.py` (cuadro congelado, 4 clics por puesto, deshacer, guardar en `space.image_polygon` y en `data/calibration/<camera_id>.json`); verificación: tras calibrar 6 puestos, `select code, image_polygon from space` los muestra y la detección los usa sin reiniciar
- [ ] 1.2 Implementar `tools/capture_reference.py` (promedio de 10 cuadros y chequeo de brillo 40–220); prueba pytest del chequeo con una imagen negra y una normal; verificación: la prueba pasa
- [ ] 1.3 Implementar `tools/demo_reset.py` y el botón oculto de desarrollo que limpia la espera de avisos en el celular; verificación: tras el reinicio, la app muestra los 6 puestos libres en menos de 10 s y Alejandría no cambia

## 2. Maqueta y ensayo técnico

- [ ] 2.1 Montar la maqueta (6 puestos, webcam a ~50 cm, lámpara fija), calibrar y capturar la referencia; verificación: con `DETECTOR=diff`, poner y quitar un carrito cambia el puesto en la app en menos de 5 s en 5 de 5 intentos
- [ ] 2.2 Probar la proyección del celular con `scrcpy` por USB y la red por hotspot; verificación: secuencia 5a–5c completa en la demo interna del sáb 14

## 3. Respaldo y cierre

- [ ] 3.1 Grabar los videos de respaldo de 5a, 5b y 5c y el video de la detección, y dejarlos en la carpeta `pitch_base` del Capstone (fuera de Git); verificación: los 4 videos se reproducen desde las diapositivas
- [ ] 3.2 Revisar con `code-review-graph` y abrir PR a `develop` con las herramientas; verificación: PR abierto con `pytest` en verde

## Workflow follow-up

- Tras el merge: `openspec archive f-prepare-pitch-demo` y resumen a Mao para la nota 18 y el estado de la demo interna.
