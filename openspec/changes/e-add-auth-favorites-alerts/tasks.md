# Tasks

Hitos de Obsidian: 13 (RF-05, RF-06) y 14 (correo y avisos). Fecha objetivo: sáb 14 nov 2026 antes de la demo interna. Requiere B y D mergeados.

## 1. Base

- [ ] 1.1 Crear `feature/e-add-auth-favorites-alerts` y la migración `…_005_account.sql` con `delete_my_account()` y `REPLICA IDENTITY FULL` en `space_state`; prueba pgTAP de que borrar la cuenta elimina perfil, favoritos y tokens; verificación: `supabase test db` pasa

## 2. Cuenta

- [ ] 2.1 Pantalla C04 de registro e inicio de sesión (correo, contraseña de 8+ caracteres, casilla de autorización obligatoria con enlace al aviso de privacidad) y `useSession`; verificación: en local se registra una cuenta, llega el correo a Inbucket y, tras confirmar, inicia sesión
- [ ] 2.2 Perfil con cerrar sesión y "Borrar mi cuenta" con confirmación; verificación: tras borrar, la sesión se cierra y la cuenta no existe en `auth.users`

## 3. Favoritos

- [ ] 3.1 Pantalla C05: guardar parqueadero o zona como favorito, interruptor de aviso, días y hora; sin sesión, el botón lleva a C04; verificación: la fila aparece en `favorite` con `notify`, `notify_days` y `notify_time` correctos

## 4. Aviso

- [ ] 4.1 Implementar `useFreeSpotAlerts` con la regla de transición a libre, ventana de días y hora y espera de 5 min; pruebas unitarias de la función de decisión (ocupado→libre avisa, libre→ocupado no, fuera de la ventana no, segundo aviso antes de 5 min no); verificación: las pruebas pasan
- [ ] 4.2 Notificación local con `expo-notifications`, banner C06 si no hay permiso y apertura de la zona al tocar; verificación: en Expo Go, al liberar un puesto con `curl` a la ingesta, el aviso llega en menos de 10 s y abre la zona

## 5. Entrega

- [ ] 5.1 Crear y confirmar en la nube la cuenta de demo de "Doña Carmen" con su zona favorita; revisar con `code-review-graph` y `security-reviewer` (sesión, borrado de cuenta) y abrir PR a `develop`; verificación: PR abierto con checks en verde

## Workflow follow-up

- Tras el merge: `openspec archive e-add-auth-favorites-alerts` y resumen a Mao para las notas 13 y 14.
