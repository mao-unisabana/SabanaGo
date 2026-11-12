# Proposal

## Why

La escena 5c del pitch muestra a Doña Carmen marcando su zona como favorita y recibiendo el aviso cuando se libera un puesto. Eso exige cuenta opcional con correo (RF-06), favoritos y aviso (RF-05), que son Should del MoSCoW y la persona 2 del hito 02. Cierra la parte de cuenta y avisos del hito 13 y lo que aplica del hito 14 (solo correo y avisos; no hay pagos ni SMS).

## What Changes

- Registro e inicio de sesión con correo y contraseña (mínimo 8 caracteres, confirmación por correo), opcional: la app sigue funcionando sin cuenta.
- Aviso de privacidad y autorización de tratamiento de datos al registrarse (Ley 1581 de 2012).
- Pantalla de perfil (C05) para guardar el parqueadero o una zona como favorito y activar "Avísame si se libera", con días y hora opcionales.
- Aviso dentro de la app (notificación local y banner) cuando un puesto de una zona favorita pasa a libre, con 5 minutos de espera entre avisos de la misma favorita.
- Cerrar sesión y borrar la cuenta (borra favoritos y tokens en cascada).

Fuera del alcance: push con la app cerrada, Edge Function `notify-favorites` y registro de `push_token` (Won't en este corte; la tabla queda lista en B), inicio con Google o enlace mágico.

## Capabilities

### New Capabilities
- `driver-account`: cuenta opcional del conductor con correo y contraseña, su consentimiento de datos y su eliminación.
- `favorite-alerts`: favoritos del conductor y el aviso cuando se libera un puesto en ellos.

### Modified Capabilities

## Impact

- `apps/mobile/`: pantallas de login/registro (C04), perfil y favoritos (C05), banner de aviso (C06); hooks `useSession`, `useFavorites`, `useFreeSpotAlerts`.
- Dependencias: `expo-notifications` (solo notificaciones locales).
- Supabase Auth: plantilla de correo de confirmación en español y URL de redirección.
- Depende de: B y D.
