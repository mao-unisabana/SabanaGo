# Spec Delta

## Purpose

Informa al usuario qué datos trata SabanaGO y para qué, y le da un canal para reportar errores durante el piloto.

## ADDED Requirements

### Requirement: Aviso de privacidad accesible
La app SHALL mostrar un aviso de privacidad y términos accesible desde el registro y desde el menú, que diga que solo se guarda el correo y el estado de los puestos y que las imágenes de las cámaras no se almacenan (Ley 1581 de 2012).

#### Scenario: Desde el registro
- **WHEN** el usuario toca el enlace del aviso en la pantalla de registro
- **THEN** ve el texto completo y puede volver al registro sin perder lo escrito

#### Scenario: Desde el menú sin cuenta
- **WHEN** un visitante sin cuenta abre el menú
- **THEN** encuentra "Privacidad y términos"

### Requirement: Reporte de errores
La app SHALL ofrecer en el menú una opción "Reportar un problema" que abra el formulario de reporte con la versión de la app y el parqueadero actual ya indicados.

#### Scenario: Reportar desde la app
- **WHEN** el usuario toca "Reportar un problema" mirando Alejandría
- **THEN** se abre el formulario con la versión de la app y "C.C. Alejandría" ya diligenciados

### Requirement: Errores de la app registrados
Un error no controlado en la interfaz SHALL mostrar una pantalla de recuperación con la opción de reportarlo, en lugar de cerrar la app.

#### Scenario: Falla una pantalla
- **WHEN** una pantalla lanza un error no controlado
- **THEN** la app muestra "Algo salió mal", un botón para reintentar y otro para reportar
