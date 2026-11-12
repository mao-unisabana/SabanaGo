# Spec Delta

## Purpose

Convierte la imagen de una cámara en el estado libre, ocupado o sin datos de cada puesto que cubre, y lo reporta a la base sin guardar nunca imágenes.

## ADDED Requirements

### Requirement: Estado por puesto desde la imagen
El servicio SHALL calcular para cada puesto activo de su cámara un estado `free` u `occupied` con una confianza entre 0 y 1, usando el polígono del puesto en píxeles.

#### Scenario: Carro dentro del puesto
- **WHEN** un vehículo cubre al menos el 30 % del polígono de un puesto
- **THEN** el puesto se reporta `occupied` con la confianza de esa detección

#### Scenario: Puesto vacío
- **WHEN** ningún vehículo cubre el polígono de un puesto
- **THEN** el puesto se reporta `free`

### Requirement: Puesto sin polígono
Los puestos sin polígono en píxeles SHALL omitirse en el cálculo, de modo que siguen en `no_data`.

#### Scenario: Puesto sin calibrar
- **WHEN** un puesto de la cámara no tiene polígono en píxeles
- **THEN** el servicio no envía estado para ese puesto

### Requirement: Estados estables
El servicio SHALL cambiar el estado reportado de un puesto solo cuando el nuevo estado se mantenga en la mayoría de los últimos 3 cuadros analizados.

#### Scenario: Detección intermitente
- **WHEN** un puesto sale `occupied` en un solo cuadro entre dos `free`
- **THEN** el servicio sigue reportándolo `free`

### Requirement: Envío de solo cambios con latido
El servicio SHALL enviar a la base solo los puestos cuyo estado reportado cambió, y SHALL enviar un lote, aunque esté vacío, al menos cada 2 segundos.

#### Scenario: Nada cambia
- **WHEN** ningún puesto cambia durante 10 segundos
- **THEN** el servicio envía al menos 5 lotes vacíos en ese tiempo

### Requirement: Fuente caída
Si la fuente de video no entrega imagen, el servicio SHALL dejar de enviar latidos hasta recuperarla, para que la base pase los puestos a `no_data`, y SHALL reintentar la conexión.

#### Scenario: Se desconecta la cámara
- **WHEN** la webcam se desconecta
- **THEN** el servicio registra el error, no envía lotes y reintenta cada 2 segundos

### Requirement: Detector configurable
El servicio SHALL permitir elegir entre un detector de vehículos reales y un detector por diferencia con la imagen del puesto vacío, sin cambiar el código.

#### Scenario: Demo con maqueta
- **WHEN** se arranca con `DETECTOR=diff`
- **THEN** el estado de cada puesto sale de comparar su región con la imagen de referencia vacía

### Requirement: Sin almacenamiento de imágenes
El servicio SHALL procesar los cuadros en memoria y no SHALL escribir imágenes, video ni cuadros en disco ni en la base, salvo la imagen de referencia vacía del detector por diferencia.

#### Scenario: Ejecución de una hora
- **WHEN** el servicio corre durante una hora
- **THEN** no aparece ningún archivo de imagen nuevo en el contenedor

### Requirement: Mismo contenedor en local y demo
El servicio SHALL correr con la misma imagen Docker en local y en la demo; solo cambian las variables de entorno (RNF-16).

#### Scenario: Arranque con compose
- **WHEN** se ejecuta `docker compose up detection` con un `.env` válido
- **THEN** el servicio empieza a enviar lotes a Supabase
