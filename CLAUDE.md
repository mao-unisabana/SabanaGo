See context.md for full project context.

## Agente global — rol y límites

El agente global NO ejecuta tareas directamente.
Su único rol: recibir la tarea → identificar el agente especializado → delegar con contexto mínimo suficiente → mantener registro compacto del estado.

Toda tarea se ejecuta desde un agente especializado. Sin excepciones.

## Delegación de tareas

Antes de ejecutar cualquier cosa:
1. Identificar qué tipo de tarea es (build, test, refactor, docs, infra, etc.)
2. Lanzar el agente especializado correspondiente
3. Pasarle solo el contexto necesario para esa tarea — no el proyecto completo

## Control de tokens

- Inputs cortos y específicos. Sin repetir contexto ya dado.
- Compartir solo los campos clave, no datos completos.
- No usar modelos pesados para tareas simples.
- Caveman rule: sin relleno, sin yapping. Respuestas directas.

## Herramientas obligatorias

- MCP `code-review-graph` activo en todo momento. Usarlo antes de marcar cualquier tarea como completada.

## Reglas del proyecto

- Nunca hacer commit ni push directo a `main` o `develop`. Todo entra por PR desde una rama `feature/` o `fix/`.
- No crear archivos `.md` de documentación adicionales. Las explicaciones van en el chat; `docs/` solo se toca cuando se pida.
- Antes de implementar algo fuera de la lista Must del MoSCoW (ver context.md), preguntar.

## Secretos y variables de entorno

| Archivo (ignorado por Git) | Plantilla versionada | Contenido | Quién lo usa |
|---|---|---|---|
| `.env` (raíz) | `.env.example` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, config de detección | `services/detection` (service_role) |
| `apps/mobile/.env` | `apps/mobile/.env.example` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app Expo (solo llave anon) |

- Nunca leer, imprimir, copiar ni hacer `cat`/`grep`/`source` de un `.env` real. Para saber si una variable está llena, preguntar a Mao.
- Para cambiar qué variables existen, editar solo el `.env.example` correspondiente y avisar a Mao que actualice su `.env`.
- Mao pega las llaves a mano; nunca pedirlas por el chat ni escribirlas en código, PRs, commits o logs.
- La `service_role` nunca va en `apps/mobile/` ni en ninguna variable `EXPO_PUBLIC_`.

## Qué NO hacer

- No ejecutar tareas desde el agente global
- No repetir contexto técnico que ya está en context.md
- No ampliar el alcance sin confirmación
- No generar código salvo que se pida explícitamente
