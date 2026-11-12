# Spec Delta

## Purpose

Entrega la ocupación actual de un parqueadero o zona a cualquier cliente y la ocupación histórica agregada al administrador.

## ADDED Requirements

### Requirement: Ocupación actual
La consulta de ocupación SHALL devolver libres, ocupados, sin datos y total de un parqueadero, o de una zona si se indica, contando solo puestos activos (RF-10).

#### Scenario: Ocupación de una zona
- **WHEN** se pide la ocupación de la zona A con 5 libres, 6 ocupados y 1 sin datos
- **THEN** responde `free=5, occupied=6, no_data=1, total=12`

#### Scenario: Puesto inactivo
- **WHEN** un puesto tiene `is_active = false`
- **THEN** no cuenta en ningún total

### Requirement: Ocupación histórica
La consulta histórica SHALL devolver, solo al administrador, el porcentaje promedio de ocupación de un parqueadero por intervalos de 15 minutos, 1 hora o 1 día entre dos fechas (RF-07).

#### Scenario: Histórico por hora
- **WHEN** el administrador pide el histórico de hoy por hora
- **THEN** recibe una fila por hora con su porcentaje de ocupación

#### Scenario: Intervalo inválido
- **WHEN** se pide un intervalo distinto de 15 min, 1 h o 1 día
- **THEN** la consulta falla con un error de parámetro
