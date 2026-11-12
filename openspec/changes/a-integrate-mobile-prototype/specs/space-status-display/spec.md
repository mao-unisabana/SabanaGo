# Spec Delta

## Purpose

Define cómo la app SabanaGO representa el estado de cada puesto y la ocupación total, para que el conductor entienda en segundos si hay cupo, incluso con daltonismo.

## ADDED Requirements

### Requirement: Tres estados de puesto
La app SHALL representar cada puesto en uno de tres estados, `free`, `occupied` o `no_data`, usando esos mismos nombres en el código y en los datos.

#### Scenario: Puesto libre
- **WHEN** un puesto tiene estado `free`
- **THEN** se pinta con borde #1F7A53 y relleno #D5EFE3

#### Scenario: Puesto ocupado
- **WHEN** un puesto tiene estado `occupied`
- **THEN** se pinta en #B83A31 con una ✕ blanca encima

#### Scenario: Puesto sin datos
- **WHEN** un puesto tiene estado `no_data` o no tiene estado conocido
- **THEN** se pinta en #6F767D con rayado diagonal y nunca se muestra como libre

### Requirement: Contador de ocupación
La app SHALL mostrar un contador de cuatro columnas, Libres, Ocupados, Sin datos y Total, calculado a partir de los puestos visibles.

#### Scenario: Contador coherente con el mapa
- **WHEN** la zona tiene 12 puestos, 5 libres, 6 ocupados y 1 sin datos
- **THEN** el contador muestra 5, 6, 1 y 12

### Requirement: Identidad visual v1.1
La app SHALL usar el nombre SabanaGO, la paleta v1.1 (primario #16587B, fondo #F5EEDD, superficie #FAF5EC, texto #202B22, texto secundario #6B6553) y solo íconos vectoriales.

#### Scenario: Sin rastros de la identidad anterior
- **WHEN** se busca en `apps/mobile` el nombre "Parqueo", los colores #2F9E6F, #D7483F o #8C856F, o caracteres emoji en la interfaz
- **THEN** no aparece ninguno

### Requirement: Modos conductor y administrador separados
La app SHALL abrir en modo conductor y mostrar las herramientas de dibujo solo en modo administrador.

#### Scenario: Apertura en modo conductor
- **WHEN** el usuario abre la app
- **THEN** ve el mapa, el contador y el filtro, sin herramientas de dibujo

#### Scenario: Cambio a modo administrador
- **WHEN** el usuario activa el modo administrador
- **THEN** aparecen las herramientas para crear parqueaderos, zonas, filas, puestos y carriles

### Requirement: Atribución del mapa base
La app SHALL mostrar la atribución del proveedor del mapa base.

#### Scenario: Atribución visible
- **WHEN** se muestra el mapa
- **THEN** la atribución de CARTO y OpenStreetMap es visible en una esquina
