# Design

## Context

La nota 11 fija correo y contraseña (se descartó el enlace mágico porque en Expo exige enlaces profundos), JWT de 1 h con renovación y aviso de privacidad en C04. La nota 10 diseña el aviso con un Database Webhook y la Edge Function `notify-favorites`, pero aclara que en el MVP el aviso es dentro de la app. Las reglas del aviso (solo transición a libre, ventana de días y hora, 5 min entre avisos) se mantienen, solo que se evalúan en el cliente. El cambio D ya deja el cliente de Supabase con sesión persistente y el formulario mínimo del modo administrador.

## Goals / Non-Goals

**Goals:**
- Que la escena 5c del pitch funcione en vivo en Expo Go.
- Mismas reglas de aviso que la nota 10, para mover luego la lógica a la Edge Function sin cambiar la experiencia.

**Non-Goals:**
- Push con la app cerrada y registro de `push_token`: en Expo Go las notificaciones remotas en Android no están disponibles y el push en segundo plano es Won't.

## Decisions

1. **Auth**: `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })` y `signInWithPassword`. La confirmación se abre en el navegador; al volver, el usuario inicia sesión con su contraseña (sin enlaces profundos). Plantilla del correo en español en el panel de Supabase.
2. **Consentimiento**: casilla obligatoria con enlace al texto del aviso de privacidad (pantalla dentro de la app, el texto lo entrega el cambio G). Se guarda la fecha de aceptación en `user_metadata.privacy_accepted_at` para no tocar el esquema.
3. **Borrar cuenta**: Supabase no permite que el cliente borre su usuario de `auth.users`. Se agrega una RPC `delete_my_account()` `security definer` que borra `auth.users where id = auth.uid()`; la cascada elimina perfil, favoritos y tokens. Es la única migración de este cambio.
4. **Favoritos**: CRUD directo sobre `favorite` (RLS de B). Días como `smallint[]` con 1 = lunes, hora como `time`, ambos en la zona horaria del parqueadero (`America/Bogota`).
5. **Aviso**: `useFreeSpotAlerts` escucha los mismos eventos Realtime del cambio D para las zonas favoritas con `notify = true` (un canal adicional por zona favorita que no sea la visible). Ante `old.status <> 'free'` y `new.status = 'free'`, revisa la ventana y la espera de 5 min (guardada en memoria y en AsyncStorage) y llama a `Notifications.scheduleNotificationAsync({ content, trigger: null })`. Sin permiso, muestra el banner C06. Requiere `REPLICA IDENTITY FULL` en `space_state` para recibir `old.status`; se agrega en la migración de este cambio.
6. **Navegación**: tocar la notificación abre la zona (`addNotificationResponseReceivedListener` + estado global de zona seleccionada).

## Risks / Trade-offs

- [El correo de confirmación tarda o cae en spam en la demo] → Crear y confirmar la cuenta de "Doña Carmen" el día anterior; la demo usa una cuenta ya confirmada.
- [`REPLICA IDENTITY FULL` aumenta el tamaño del WAL] → Tabla de decenas de filas; impacto despreciable.
- [Desviación de la nota 10: lógica del aviso en el cliente] → Documentada; las reglas son idénticas y la Edge Function queda como mejora posterior.

## Migration Plan

1. Migración `…_005_account.sql` con `delete_my_account()` y `REPLICA IDENTITY FULL` en `space_state`.
2. Probar en local con Inbucket (correo de `supabase start`) y luego en la nube.
3. Rollback: revertir el PR y la migración con una migración inversa.
