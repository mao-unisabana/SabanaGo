# Spec Delta

## Purpose

Permite preparar, calibrar, reiniciar y respaldar la demostración en vivo de SabanaGO para que la escena de la maqueta funcione igual en cada ensayo y en la entrega.

## ADDED Requirements

### Requirement: Calibración de puestos sobre la imagen
La herramienta de calibración SHALL mostrar un cuadro de la cámara y permitir marcar los 4 vértices de cada puesto, guardándolos como polígono en píxeles del puesto en la base.

#### Scenario: Calibrar la maqueta
- **WHEN** el operador marca los 4 vértices de los 6 puestos de la maqueta y guarda
- **THEN** los 6 puestos tienen polígono en píxeles y la detección los usa en menos de 60 segundos sin reiniciarse

#### Scenario: Corregir un puesto
- **WHEN** el operador vuelve a marcar un puesto ya calibrado
- **THEN** se reemplaza solo el polígono de ese puesto

### Requirement: Referencia vacía con chequeo de luz
La captura de referencia SHALL guardar la imagen del parqueadero vacío y SHALL advertir si el brillo medio está fuera del rango usable.

#### Scenario: Luz insuficiente
- **WHEN** se captura la referencia con la imagen casi negra
- **THEN** la herramienta muestra una advertencia y no reemplaza la referencia anterior

### Requirement: Reinicio rápido de la demo
El reinicio SHALL dejar todos los puestos de la maqueta en `free` y la cámara en línea en menos de 10 segundos, sin tocar otros parqueaderos.

#### Scenario: Antes de cada ensayo
- **WHEN** el operador ejecuta el reinicio de la demo
- **THEN** la app muestra los 6 puestos de la maqueta libres y Alejandría no cambia

### Requirement: Respaldo grabado
Cada escena en vivo de la demo SHALL tener un video de respaldo que muestre el mismo resultado.

#### Scenario: Falla la red en el salón
- **WHEN** la conexión falla durante la escena 5b
- **THEN** el presentador pasa al video de respaldo de la escena 5b sin salir de la presentación
