# Proposal

## Why

El pitch del 17 nov tiene 3 minutos de demo en vivo (escenas 5a a 5c): un carrito entra a un puesto de la maqueta, el puesto se pone rojo en el celular proyectado y, al quitarlo, a "Doña Carmen" le llega el aviso. Para que eso salga bien hay que calibrar los puestos de la maqueta en la imagen de la cámara, poder dejar la demo en un estado conocido en segundos y tener un respaldo grabado. Cierra lo que aplica del hito 18 (entorno de demo) y la demo interna del sáb 14 nov.

## What Changes

- Herramienta de calibración: sobre un cuadro de la cámara se marcan los 4 vértices de cada puesto y se guardan como `image_polygon` en la base.
- Captura de la imagen de referencia vacía para el detector por diferencia, con chequeo de luz.
- Reinicio de la demo: un comando deja la maqueta con todos sus puestos en `no_data` o `free` y borra los avisos recientes, para ensayar varias veces seguidas.
- Grabación del video de respaldo de las escenas 5a a 5c y del video de la detección.
- Lista de verificación de la demo: proyección del celular, red, llaves, cuenta de demo y tiempos.

Fuera del alcance: modo demo P07 con datos simulados dentro de la app (Could) y despliegue productivo (Won't).

## Capabilities

### New Capabilities
- `demo-operations`: cómo se prepara, calibra, reinicia y respalda la demostración en vivo del sistema.

### Modified Capabilities

## Impact

- `services/detection/sabanago_detection/tools/`: `calibrate.py`, `capture_reference.py`, `demo_reset.py`.
- `supabase/seed_demo.sql` (si el reinicio se hace por SQL).
- Material fuera del repo: maqueta física, webcam y soporte, videos de respaldo en la carpeta del Capstone (no en Git).
- Depende de: B, C, D y E.
