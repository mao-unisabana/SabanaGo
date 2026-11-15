# Spec Delta

## Purpose

Permite al conductor con cuenta guardar un parqueadero o una zona y enterarse en segundos cuando se libera un puesto allí.

## ADDED Requirements

### Requirement: Guardar favoritos
Un usuario con sesión SHALL poder guardar como favorito un parqueadero completo o una zona, y editarlo o quitarlo.

#### Scenario: Zona favorita
- **WHEN** el usuario guarda la zona A de Alejandría
- **THEN** la zona aparece en su perfil como favorita

### Requirement: Activar aviso
Cada favorito SHALL tener un interruptor "Avísame si se libera" y, opcionalmente, días de la semana y hora desde la que quiere avisos.

#### Scenario: Aviso solo los domingos
- **WHEN** el usuario activa el aviso para los domingos desde las 11:00
- **THEN** un puesto liberado un sábado no genera aviso

### Requirement: Aviso al liberarse un puesto
Con la app abierta, cuando un puesto de un favorito con aviso activo pasa de `occupied` o `no_data` a `free`, la app SHALL mostrar un aviso en menos de 10 segundos (RF-05).

#### Scenario: Se libera un puesto
- **WHEN** un puesto de la zona favorita pasa de `occupied` a `free`
- **THEN** aparece una notificación "Hay puesto libre en Zona A" y, al tocarla, la app abre esa zona

#### Scenario: Cambio a ocupado
- **WHEN** un puesto de la zona favorita pasa de `free` a `occupied`
- **THEN** no aparece ningún aviso

### Requirement: Espera entre avisos
La app SHALL esperar al menos 5 minutos entre dos avisos de un mismo favorito.

#### Scenario: Dos puestos liberados seguidos
- **WHEN** se liberan dos puestos de la zona favorita con 1 minuto de diferencia
- **THEN** solo aparece un aviso

### Requirement: Permiso de notificaciones
Si el usuario no da permiso de notificaciones, la app SHALL mostrar el aviso como banner dentro de la app.

#### Scenario: Permiso negado
- **WHEN** el usuario negó el permiso y se libera un puesto favorito
- **THEN** aparece el banner dentro de la app
