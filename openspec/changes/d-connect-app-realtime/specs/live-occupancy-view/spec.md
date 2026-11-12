# Spec Delta

## Purpose

Mantiene en la pantalla del conductor el estado real de cada puesto y la ocupación del parqueadero, actualizados en segundos y sin necesidad de cuenta.

## ADDED Requirements

### Requirement: Datos desde la base sin cuenta
La app SHALL cargar parqueaderos, zonas, puestos y sus estados desde Supabase sin pedir inicio de sesión (RF-06).

#### Scenario: Primera apertura
- **WHEN** un conductor sin cuenta abre la app con conexión
- **THEN** ve el parqueadero, sus zonas y los puestos con su estado actual

### Requirement: Actualización en vivo
La app SHALL repintar un puesto en menos de 5 segundos desde que cambia en la base, en el 95 % de los casos (RF-02, RNF-01).

#### Scenario: Puesto que se ocupa
- **WHEN** un puesto de la zona visible pasa de `free` a `occupied` en la base
- **THEN** la app lo muestra ocupado en menos de 5 segundos sin que el usuario haga nada

### Requirement: Recarga al reconectar
Al abrir la app, al cambiar de zona o al recuperar la conexión, la app SHALL recargar todos los estados de la zona antes de seguir escuchando cambios.

#### Scenario: Vuelve la señal
- **WHEN** el celular pierde la conexión 30 segundos y la recupera
- **THEN** la app recarga los estados y muestra los cambios ocurridos mientras estuvo sin señal

### Requirement: Último estado conocido
Sin conexión, la app SHALL mostrar el último estado conocido con su antigüedad y nunca un mapa vacío (RNF-08).

#### Scenario: Sin conexión al abrir
- **WHEN** el conductor abre la app sin conexión después de haberla usado
- **THEN** ve el último estado guardado con el texto "Última actualización hace N min"

### Requirement: Indicador en vivo
La app SHALL mostrar cuántos segundos han pasado desde el último dato recibido.

#### Scenario: Datos al día
- **WHEN** el último cambio o recarga ocurrió hace 3 segundos
- **THEN** la barra muestra "En vivo · hace 3 s"

### Requirement: Cámara sin señal
Cuando una cámara del parqueadero está fuera de línea, la app SHALL mostrar un aviso y sus puestos en `no_data`.

#### Scenario: Cámara caída
- **WHEN** la cámara de la zona A deja de reportar
- **THEN** la app muestra "Cámara sin señal" y los puestos de la zona A en gris

### Requirement: Filtro por zona y ocupación total
La app SHALL permitir elegir la zona y mostrar la ocupación del parqueadero completo o de la zona elegida (RF-04, RF-10).

#### Scenario: Elegir zona
- **WHEN** el conductor elige la zona A
- **THEN** el mapa se centra en la zona A y el contador muestra solo sus puestos
