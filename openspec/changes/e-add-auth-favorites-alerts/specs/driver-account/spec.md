# Spec Delta

## Purpose

Da al conductor frecuente una cuenta opcional con correo y contraseña para guardar favoritos y recibir avisos, sin obligar al visitante ocasional a registrarse.

## ADDED Requirements

### Requirement: Cuenta opcional
La app SHALL permitir usar el mapa, la ocupación y el filtro sin cuenta, y SHALL pedir inicio de sesión solo para favoritos y avisos (RF-06).

#### Scenario: Visitante sin cuenta
- **WHEN** un conductor sin cuenta abre la app
- **THEN** ve el mapa y la ocupación sin ninguna pantalla de registro

#### Scenario: Intenta guardar favorito sin cuenta
- **WHEN** un conductor sin cuenta toca "Guardar como favorito"
- **THEN** la app lo lleva a iniciar sesión o registrarse

### Requirement: Registro con correo y contraseña
El registro SHALL pedir correo y una contraseña de al menos 8 caracteres y SHALL exigir confirmar el correo antes de iniciar sesión.

#### Scenario: Contraseña corta
- **WHEN** alguien intenta registrarse con una contraseña de 6 caracteres
- **THEN** la app muestra el error y no crea la cuenta

### Requirement: Autorización de tratamiento de datos
El registro SHALL mostrar el aviso de privacidad y SHALL exigir que el usuario lo acepte antes de crear la cuenta (Ley 1581 de 2012).

#### Scenario: No acepta el aviso
- **WHEN** el usuario no marca la casilla de autorización
- **THEN** el botón de registrarse queda deshabilitado

### Requirement: Sesión persistente
La sesión SHALL mantenerse al cerrar y abrir la app hasta que el usuario cierre sesión.

#### Scenario: Reabrir la app
- **WHEN** un usuario con sesión cierra la app y la abre al día siguiente
- **THEN** sigue con sesión y ve sus favoritos

### Requirement: Borrar la cuenta
El usuario SHALL poder borrar su cuenta desde el perfil, lo que elimina su perfil, favoritos y tokens.

#### Scenario: Borrar cuenta
- **WHEN** el usuario confirma "Borrar mi cuenta"
- **THEN** no quedan filas suyas en `profile`, `favorite` ni `push_token`
