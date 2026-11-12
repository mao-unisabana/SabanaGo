# Spec Delta

## Purpose

Define qué puede ver y cambiar cada tipo de actor (visitante, usuario, administrador y servicio de detección) y cómo responde el sistema cuando niega el acceso.

## ADDED Requirements

### Requirement: Visitante solo lectura pública
Un visitante sin sesión SHALL poder leer parqueaderos, zonas, puestos, estados actuales y la vista de estado de cámaras, y nada más.

#### Scenario: Visitante consulta el mapa
- **WHEN** un cliente con la llave anónima pide los puestos de una zona con su estado
- **THEN** recibe la lista

#### Scenario: Visitante pide datos privados
- **WHEN** un cliente sin sesión pide favoritos, histórico o la tabla de cámaras
- **THEN** no recibe ninguna fila o recibe 401

### Requirement: Datos propios del usuario
Un usuario con sesión SHALL ver, crear, editar y borrar solo sus propios favoritos y tokens de notificación.

#### Scenario: Favoritos de otro
- **WHEN** el usuario A pide o intenta borrar un favorito del usuario B
- **THEN** no lo ve y no lo borra

### Requirement: Rol no editable por el usuario
Un usuario SHALL poder editar solo `full_name` de su perfil; el rol solo se asigna desde el panel de Supabase.

#### Scenario: Intento de volverse admin
- **WHEN** un usuario actualiza su propio `role` a `admin`
- **THEN** la operación falla y el rol sigue en `user`

### Requirement: Funciones de administrador protegidas
Las funciones del panel y el histórico SHALL responder 403 a un usuario con sesión sin rol admin y 401 a un visitante sin sesión (RNF-04 ajustado).

#### Scenario: Usuario sin rol admin
- **WHEN** un usuario con rol `user` llama a `admin_set_zone_active`
- **THEN** recibe 403 y la zona no cambia

#### Scenario: Visitante
- **WHEN** un cliente sin sesión llama a `get_occupancy_history`
- **THEN** recibe 401

### Requirement: Escritura de estados solo por la detección
Ni visitantes ni usuarios SHALL poder escribir estados de puestos ni llamar a la función de ingesta.

#### Scenario: Usuario intenta escribir un estado
- **WHEN** un usuario con sesión hace UPDATE en `space_state` o llama a `ingest_space_states`
- **THEN** la operación falla

### Requirement: URL de cámara oculta
La URL de origen de las cámaras SHALL ser legible solo por el administrador y la detección; la app usa una vista sin esa columna.

#### Scenario: App consulta cámaras
- **WHEN** la app consulta `camera_status`
- **THEN** recibe `id`, `parking_lot_id`, `name`, `is_online` y `last_seen_at`, sin `source_url`
