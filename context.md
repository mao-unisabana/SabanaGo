# SabanaGO

## Descripción
App que muestra en tiempo real los puestos libres de un parqueadero grande, detectados con cámaras y visión por computador, para que el conductor sepa si hay cupo antes de entrar. Proyecto Capstone (Universidad de La Sabana, 2026-2) con piloto en el parqueadero del C.C. Alejandría (Cajicá, 30–45 puestos).

## Stack
- App: Expo · React Native · TypeScript · react-native-svg (web + Android + iOS)
- Datos, auth y tiempo real: Supabase (PostgreSQL, Auth con correo, Realtime, RLS, Edge Functions)
- Detección: Python 3.11 · FastAPI · Ultralytics YOLOv8 (yolov8n) · OpenCV, en Docker
- Notificaciones: Expo Push (in-app en el MVP)
- Repo: monorepo en GitHub (mao-unisabana/SabanaGo)

## Arquitectura
- `services/detection/`: lee video, cruza las cajas de carros de YOLO con un polígono por puesto y escribe el estado (free / occupied / no_data + confianza) en Supabase. Solo escribe en la BD; no expone nada a la app.
- `supabase/`: migraciones, políticas RLS y seed de la zona piloto. Tablas: parking_lot, zone, space, space_state (estado actual), occupancy_log (histórico con timestamp), favorite. Estados de un puesto: free / occupied / no_data.
- `apps/mobile/`: plano del parqueadero por colores, ocupación total, filtro por zona, login opcional, favoritos y panel admin (rol admin vía RLS).
- Flujo: frame → detección → Supabase → Realtime → app. Meta extremo a extremo ≤5 s; aviso ≤10 s.
- Entornos: Local (supabase start + docker compose + expo start) y Demo (Supabase nube + mismo contenedor).

## Convenciones
- Código, identificadores y base de datos (tablas, columnas, enums) en inglés.
- Comentarios en el código y mensajes de commit en español.
- Ramas: main (demo, solo por PR), develop (integración), feature/<tema>, fix/<tema> tras el congelamiento.
- Secretos solo en .env (en .gitignore); .env.example siempre actualizado.
- La service_role de Supabase solo la usa el servicio de detección.

## Restricciones técnicas
- Alcance cerrado por MoSCoW. Must: RF-01 (1 zona), RF-02, RF-03, RF-08, RF-10. Should: RF-04, RF-05, RF-06, RF-07. Could: RF-09.
- Won't en este corte: publicar en tiendas, push nativo en segundo plano, reservas, pagos, ruteo interno, sensores IoT, CI/CD y dominio productivo.
- Confianza < 0.7 o cámara caída → no_data (gris) en ≤5 s. Nunca mostrar mapa vacío: último estado conocido.
- No guardar imágenes de las cámaras; solo el estado de cada puesto (Habeas Data, Ley 1581/2012).
- Agregar zonas o parqueaderos no debe cambiar el modelo de datos.
- Las métricas (precisión ≤5% de error, tiempos) se reportan tal cual; no se ajustan las metas.
- Demo interna: 14 nov 2026. Congelamiento de funciones: 15 nov 2026. Entrega final (plazo máximo): martes 17 nov 2026.

## Contexto de negocio
- Problema: tiempo perdido y emisiones por dar vueltas buscando parqueadero.
- Usuarios: visitante ocasional que deja el carro para caminar Cajicá (sin cuenta), usuario frecuente con horario fijo (favorito + aviso) y administración del parqueadero (panel, histórico).
- Horas pico: tardes entre semana y almuerzo de fin de semana.
- Sin autorización de las cámaras del parqueadero, el MVP corre sobre video grabado (Plan B).
- Equipo: Mafe, Juan, Felipe y Mao. Documentación del proyecto en el Obsidian de Mao (Capstone/Cronograma).
