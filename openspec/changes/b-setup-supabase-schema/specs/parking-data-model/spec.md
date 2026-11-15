# Spec Delta

## Purpose

Guarda la estructura física de cada parqueadero (zonas, cámaras y puestos), el estado actual de cada puesto y su histórico, y mantiene sola las reglas que no deben depender de la app.

## ADDED Requirements

### Requirement: Modelo extensible sin cambiar tablas
La base SHALL permitir agregar parqueaderos, zonas, cámaras y puestos insertando filas, sin cambiar el esquema (RNF-09).

#### Scenario: Segundo parqueadero
- **WHEN** se inserta el parqueadero de la maqueta con su zona y sus puestos
- **THEN** la app y las consultas lo muestran sin ninguna migración nueva

### Requirement: Un estado actual por puesto
Cada puesto SHALL tener como máximo una fila de estado actual, con `status` en `free`, `occupied` o `no_data`, `confidence` entre 0 y 1 y `zone_id` igual al de su puesto.

#### Scenario: Puesto nuevo sin detección
- **WHEN** se crea un puesto y todavía no hay detección
- **THEN** su estado actual es `no_data`

#### Scenario: zone_id copiado
- **WHEN** se inserta o actualiza el estado de un puesto de la zona 3
- **THEN** la fila de estado queda con `zone_id = 3` aunque el cliente envíe otro valor

### Requirement: Histórico solo en cambios
La base SHALL registrar en el histórico una fila por cada cambio de `status` de un puesto, con su confianza y la hora del cambio.

#### Scenario: Cambio de estado
- **WHEN** un puesto pasa de `free` a `occupied`
- **THEN** se agrega una fila al histórico con `occupied`

#### Scenario: Mismo estado repetido
- **WHEN** llega el mismo estado que ya tenía el puesto
- **THEN** no se agrega ninguna fila al histórico

### Requirement: Zona apagada sin datos
Cuando una zona se desactiva, sus puestos SHALL pasar a `no_data`.

#### Scenario: Apagar zona
- **WHEN** el administrador desactiva la zona A
- **THEN** todos los puestos de la zona A quedan en `no_data`

### Requirement: Cámara y puesto del mismo parqueadero
La base SHALL rechazar asignar a un puesto una cámara de otro parqueadero.

#### Scenario: Cámara ajena
- **WHEN** se asigna a un puesto de Alejandría la cámara de la maqueta
- **THEN** la operación falla con error

### Requirement: Perfil sincronizado con la cuenta
Al registrarse un usuario, la base SHALL crear su perfil con su correo y el rol `user`.

#### Scenario: Registro
- **WHEN** se crea una cuenta con correo y contraseña
- **THEN** existe su perfil con ese correo y rol `user`

### Requirement: Favorito único
La base SHALL impedir dos favoritos iguales del mismo usuario, parqueadero y zona, incluido el caso de zona vacía.

#### Scenario: Favorito de todo el parqueadero repetido
- **WHEN** un usuario guarda dos veces el parqueadero completo como favorito
- **THEN** la segunda inserción falla por duplicado

### Requirement: Sin imágenes almacenadas
El modelo SHALL guardar solo estados de puestos; ninguna tabla guarda imágenes, video ni fotogramas (Ley 1581 de 2012).

#### Scenario: Revisión del esquema
- **WHEN** se revisan las columnas de todas las tablas
- **THEN** no hay columnas de tipo `bytea` ni rutas a imágenes de cámaras
