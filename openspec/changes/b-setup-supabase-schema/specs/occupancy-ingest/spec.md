# Spec Delta

## Purpose

Recibe en la base el estado que calcula el servicio de detección, aplica el umbral de confianza y marca como sin datos los puestos cuya cámara deja de reportar.

## ADDED Requirements

### Requirement: Ingesta por lote con latido
La ingesta SHALL aceptar un lote `{camera_id, states:[{space_id, status, confidence}]}`, actualizar los estados recibidos y siempre registrar el latido de la cámara, aunque el lote venga vacío.

#### Scenario: Lote con cambios
- **WHEN** la detección envía dos puestos de la cámara 1
- **THEN** esos dos estados se actualizan y la cámara 1 queda en línea con `last_seen_at` ahora

#### Scenario: Lote vacío
- **WHEN** la detección envía un lote sin estados
- **THEN** solo se actualizan `last_seen_at` e `is_online` de la cámara

### Requirement: Umbral de confianza
La ingesta SHALL guardar `no_data` cuando la confianza recibida sea menor a 0,7 (RF-08).

#### Scenario: Confianza baja
- **WHEN** llega `free` con confianza 0,6
- **THEN** el puesto queda en `no_data` con confianza 0,6

### Requirement: Puesto ajeno a la cámara
La ingesta SHALL ignorar los puestos que no pertenecen a la cámara que envía el lote.

#### Scenario: Puesto de otra cámara
- **WHEN** la cámara 1 envía un estado del puesto de la cámara 2
- **THEN** ese estado no se aplica

### Requirement: Cámara sin latido
Los puestos de una cámara sin latido por más de 5 segundos SHALL pasar a `no_data` y la cámara a fuera de línea (RF-08, RNF-08).

#### Scenario: Detección detenida
- **WHEN** la detección deja de enviar lotes durante 10 segundos
- **THEN** todos los puestos de esa cámara están en `no_data`

### Requirement: Cambios visibles en tiempo real
Todo cambio en el estado actual de un puesto SHALL publicarse por Realtime con su `zone_id` para que los clientes filtren por zona.

#### Scenario: Suscripción por zona
- **WHEN** un cliente escucha la zona 3 y cambia un puesto de la zona 3
- **THEN** el cliente recibe el cambio con el nuevo `status`
