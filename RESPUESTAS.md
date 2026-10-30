# Respuestas · Laboratorio 4
Alumno: 20206234
Presupuesto: 11 min  Métrica DORA: time to restore

## Parte 1 · Diagnóstico

### Defecto 1
- Job y etapa: `load`, post-deploy.
- Problema que causa en el pipeline: corre en pull requests, push y ejecución manual, con 12 min de carga (stages de 1+10+1 min). Es el 77 % de los 15 min 59 s de jobs del run base: retrasa la retroalimentación de cada PR y mantiene 30 usuarios virtuales sobre la Lambda compartida con los despliegues de otros PRs.
- Link al commit: https://github.com/darkJCdark/INF384-LAB4-20206234/commit/428f91d309a348669d9a39388d4709d33f297b47
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): ajustar configuración (`if: github.ref == 'refs/heads/main'`; deja de correr en pull requests).
- Evidencia (dato observado, con link al run o fragmento de la salida local): run base https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40956851525, job `load` = 12 min 16 s (736 s) de 959 s sumados (77 %).

### Defecto 2
- Job y etapa: `smoke`, etapa deploy (`needs: build-push`); debe estar en post-deploy.
- Problema que causa en el pipeline: arranca a la vez que `deploy`, por lo que puede probar la versión anterior de la Lambda. Además no recibe `EXPECTED_COMMIT` (que `smoke.sh` ya soporta), así que aprueba aunque responda otro commit. `e2e` y `load` dependen de `smoke` y heredan el error.
- Link al commit: https://github.com/darkJCdark/INF384-LAB4-20206234/commit/3511b5e122f3376cd38a363b5b49f7b475726afe
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): mover de etapa (`needs: deploy`) y ajustar configuración (`EXPECTED_COMMIT: ${{ github.sha }}`).
- Evidencia (dato observado, con link al run o fragmento de la salida local): en el run base (.../runs/40956851525) `deploy` inició a las 21:21:13 GMT y duró 22 s; `smoke` inició a las 21:21:19 GMT, con `deploy` aún en curso. El paso `Smoke` imprime solo `salud:` y `saldo:`, sin línea `commit:`. Tras la corrección, el run https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40966240874 ejecuta `build-push → deploy → smoke` en secuencia.

### Defecto 3
- Job y etapa: workflow completo (`ci.yml`, nivel workflow; no es un job ni una etapa).
- Problema que causa en el pipeline: sin `concurrency`, dos ejecuciones seguidas lanzan dos pipelines completos (unos 16 min de jobs cada uno) sobre la misma Lambda. Un run puede redesplegar la función mientras el otro ejecuta `smoke`, `e2e` o `load`, y esos resultados dejan de corresponder al commit probado.
- Link al commit: https://github.com/darkJCdark/INF384-LAB4-20206234/commit/f13fbdef02c46efe87a1c033370e018e62dd05f5
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): ajustar configuración (`concurrency` por rama; cancela los runs obsoletos solo en pull requests).
- Evidencia (dato observado, con link al run o fragmento de la salida local): dos ejecuciones lanzadas seguidas sobre `main`, ambas `In progress` a la vez: https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40962204030 y https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40962216638 (canceladas a mano).

### Defecto 4
- Job y etapa: `integration`, pre-build (`test/integration/transferir.test.js`).
- Problema que causa en el pipeline: las 12 pruebas comparten una sola base y dependen del orden: "el saldo de beto refleja el credito" espera 600 porque la primera prueba transfirió 100 sobre los 500 semilla. Aislada, reordenada o en una segunda corrida con el mismo `DB_PATH`, falla sin defecto real, y no se puede paralelizar.
- Link al commit: https://github.com/darkJCdark/INF384-LAB4-20206234/commit/dabcd67d0072a8eabde44dc7daf5b24ae21ebe18
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): modificar tests (base SQLite propia por prueba mediante `DB_PATH` en `beforeEach`).
- Evidencia (dato observado, con link al run o fragmento de la salida local): log de `integration` del run base .../runs/40956851525: `# tests 12`, en orden fijo; el 600 de la prueba 3 (línea 25 del archivo original) solo existe si corrió antes la prueba 1 (línea 14). Tras la corrección, el run .../runs/40966240874 muestra `# tests 8`, `# pass 8`, `# fail 0`.

### Defecto 5
- Job y etapa: `e2e`, post-deploy (`test/e2e/api.spec.ts`).
- Problema que causa en el pipeline: 9 de las 10 pruebas son llamadas HTTP sin navegador que ya cubren `smoke` e `integration`; dos tienen aserciones vacías (`saldo >= 0` lo garantiza el `CHECK` de la tabla y el bucle sobre el historial pasa con la lista vacía). El job paga 36 s de instalación de Chromium por 4,3 s de pruebas; E2E debe reservarse a recorridos críticos.
- Link al commit: https://github.com/darkJCdark/INF384-LAB4-20206234/commit/f3036fb04e0a0226b1e7eddff3935eeb6b8ec0e8
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): eliminar 8 pruebas y modificar tests (quedan la lectura en navegador y la transferencia por la URL pública).
- Evidencia (dato observado, con link al run o fragmento de la salida local): run base .../runs/40956851525, job `e2e`: paso `Navegador` = 36 s de 1 min 1 s del job; paso `Playwright`: `10 passed (4.3s)`. Solo la prueba 4 usa navegador; las otras 9 usan `page.request`.

## Parte 2 · Implementación
- Link al run en verde en main: https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40966240874 (ejecución manual, commit f3036fb; su historial contiene los cinco commits de la Parte 1: 428f91d, 3511b5e, f13fbde, dabcd67 y f3036fb; 13 min 58 s de reloj, 15 min 03 s de suma de jobs).
- Link al pull request: https://github.com/darkJCdark/INF384-LAB4-20206234/pull/1 (`defecto/saldo-exacto` → `main` del fork; abierto, sin merge; contiene solo el commit e7c566d). Nota: el mismo cambio se hizo antes por error en `main` (8f830b7) y se revirtió en cf193d0; el run en verde citado es anterior a ambos.
- Defecto de la aplicación introducido (archivo y descripción): `src/wallet.js`, función `transferir`, línea 54 (commit e7c566d, https://github.com/darkJCdark/INF384-LAB4-20206234/commit/e7c566d125f7b2098a774bd0ae4e79d6bd9a2e23): `if (cuentaOrigen.saldo < centimos)` pasó a `<=`. Una transferencia por el saldo exacto del origen (diego envía sus 300 soles a elena) se rechaza con HTTP 400 "saldo insuficiente" aunque tiene fondos justos.
- Job que debería detenerlo: `unit`. La prueba "transferir todo el saldo deja el origen en cero" (`test/unit/wallet.test.js`, línea 53) falla con "saldo insuficiente" (27 de 28 aprobadas). `integration` también falla (6 de 8 aprobadas): "diego transfiere todo su saldo a elena y despues no puede transferir" recibe 400 en lugar de 200 y el historial de elena tiene 0 movimientos en lugar de 1. `build-push` no se ejecuta, así que no hay despliegue.
- Link al run fallido: https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40970318956 (evento pull_request del PR #1; `unit` en rojo a los 11 s e `integration` en rojo a los 14 s; `build-push`, `deploy`, `smoke`, `e2e` y `load` no se ejecutaron; 28 s en total).

## Parte 3 · Decisión bajo restricción
Link al run medido: https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40966240874

| Job | Duración (min:seg) |
|---|---|
| unit | 0:13 |
| integration | 0:11 |
| sast | 0:17 |
| sca | 0:19 |
| build-push | 0:43 |
| deploy | 0:16 |
| smoke | 0:11 |
| e2e | 0:41 |
| load | 12:12 |
| **Total** | 15:03 (suma de jobs; 13:58 de reloj) |

Resultado de load en ese run:
| Métrica | Valor |
|---|---|
| p90 | 49,26 ms |
| p95 | 51,32 ms |
| Máximo | 167,27 ms |
| Tasa de error | 0,00 % (0 de 36 514 requests) |
| Requests por segundo | 50,64 |

Conclusión sobre el comportamiento bajo carga: estable. Con 30 VUs durante 12 min (36 514 requests, checks al 100 %) el p95 fue 51,32 ms, diez veces por debajo del umbral de 500 ms, y el máximo 167,27 ms, sin degradación. Límites de la prueba: el 0,00 % de error acepta los 400 como respuestas esperadas, y los 50 rps los fija el `sleep(1)` de cada VU, no la capacidad de la función; confirma estabilidad a esa carga, no mide el límite.

SLO propuesto (percentil, valor, ventana) y justificación: p95 < 150 ms. Ventana: en el pipeline, la corrida completa de k6 (30 VUs; 6 min con 4 min de carga constante); como objetivo de servicio, ventana móvil de 28 días. Configurado en `SLO_P95: 150` de `ci.yml` (commit c1aca30). Otra corrida del mismo script (run #8, commit 89c09c4) dio p95 = 81,18 ms y mínimo de 69,73 ms frente a 30,72 ms: la latencia base varía unos 39 ms entre runs sin cambiar la aplicación. Con 100 ms la holgura sobre ese valor sería de 18,8 ms y `load` fallaría por variación normal; 150 ms deja 1,85 veces de holgura y es 3,3 veces más estricto que el umbral original de 500 ms, que no detectaba degradaciones de hasta 9 veces. El run #8 falló por un `SLO_P95: <valor>` mal escrito en el commit 97e62c1 (k6 evaluó `p(95)<NaN`), no por latencia; se corrigió en c1aca30.

SLA propuesto y diferencia con el SLO: disponibilidad mensual ≥ 99,5 % (respuestas sin error 5xx) y p95 ≤ 500 ms medido cada mes, con compensación al cliente si se incumple. El SLO (150 ms) es una meta interna que se verifica en cada run; el SLA es un compromiso con consecuencias contractuales y por eso es más holgado (500 ms): el equipo agota su margen interno antes de incumplir lo prometido.

Cambios para cumplir el presupuesto:
| Cambio | Job | Minutos recuperados |
|---|---|---|
| Carga constante de k6 de 10 a 4 min en `test/load/transferir.js` (commit 89c09c4); `load` sigue en cada run de `main` y evalúa `SLO_P95` | load | 6 min 3 s (de 12:12 a 6:09) |

Total resultante: 9 min 00 s (540 s = 14 + 11 + 21 + 17 + 33 + 19 + 12 + 44 + 369 s), 2 min por debajo del presupuesto de 11 min; 7 min 55 s de reloj.
Link al run en main con los cambios: https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/41033690090 (run #9, push a `main`, commit c1aca30, verde).

Riesgo aceptado (defecto de la aplicación concreto y efecto en la métrica DORA asignada): quitar `LIMIT 50` de la consulta `leerMovimientos` en `src/db.js` (líneas 41 a 47). `GET /historial/{usuario}` devolvería todos los movimientos acumulados (el run #8 generó 7 854 transferencias en 6 min), con respuesta, memoria y latencia crecientes y riesgo de agotar el timeout de 15 s. Ningún job lo detecta: `unit` usa un store falso, `integration` crea una base por prueba con menos de 50 movimientos, y `e2e`, `smoke` y `load` no consultan `/historial`. Se acepta porque ese endpoint no está en el camino de la transferencia y cubrirlo exigiría ampliar `load` o agregar una prueba con más de 50 movimientos. Efecto en time to restore: sube. El defecto llega a producción y se detecta por sus síntomas, no antes del despliegue, y esa detección tardía se suma al tiempo de restauración. El recorte de `load` solo reduce la espera de una corrección en cola detrás de un run en curso (los push no cancelan runs activos): de hasta 13 min 58 s a hasta 7 min 55 s; la corrección llega a `deploy` unos 73 s después de iniciar su run (`sast` 21 s + `build-push` 33 s + `deploy` 19 s).

Decisión sobre sast (se queda / se mueve a otra etapa o evento / informativo) y razón: se queda, bloqueante en pre-build. En el run #9 costó 21 s (3,9 % de los 540 s); corre en paralelo con `unit`, `integration` y `sca` y solo agrega 4 s al camino previo a `build-push` (21 s frente a los 17 s de `sca`). El presupuesto ya se cumple con 2 min de margen. Efecto en time to restore: no cambia en la práctica (unos 4 s más hasta `deploy`); moverlo después del despliegue o dejarlo informativo permitiría que un hallazgo de severidad ERROR llegue a producción y obligaría a restaurar con un nuevo run.

## Declaración de uso de IA
Herramientas usadas y para qué: Claude (Anthropic, aplicación Claude Cowork), en varias conversaciones. Lo usé para leer el enunciado y el repositorio sin modificarlo, ordenar los pasos de las Partes 2 y 3, reproducir localmente el defecto de la Parte 2, calcular sumas y márgenes de tiempo, interpretar los logs de k6 y de los jobs, y redactar borradores. Los commits, los cambios en `ci.yml` y `test/`, la rama, el PR y todos los runs los hice yo; la herramienta no tuvo acceso de escritura al repositorio.

Conceptos de la teoría que apliqué:
- Tiempo de retroalimentación como presupuesto y pirámide de pruebas: E2E reducida a dos recorridos críticos (defecto 5); presupuesto medido como suma de jobs, de 15:03 a 9:00.
- Pruebas independientes y datos sin estado compartido: una base SQLite por prueba de `integration` (defecto 4).
- Etapas del pipeline y trazabilidad de lo desplegado: `smoke` después de `deploy` y verificando el commit (defecto 2).
- Concurrencia sobre un recurso compartido: cancelar los runs obsoletos de PR y no los de `main` (defecto 3).
- Tipos de prueba de rendimiento, percentiles y SLI/SLO/SLA: `load` es una prueba de carga que corre solo en `main` (defecto 1); p95 en lugar de promedio; SLO de 150 ms tras observar p95 de 51,32 y 81,18 ms; SLA más holgado que el SLO. Limitación: 4 min de carga no mide capacidad ni degradación en el tiempo.
- Costo de SAST frente a su etapa y política de compuertas: `sast` se queda antes del despliegue (+4 s) y `unit`, `integration`, `sast`, `sca` y el umbral de `load` siguen deteniendo el pipeline.
- Time to restore: lo descompuse en detección, pipeline hasta `deploy` (73 s) y espera en cola, y con eso evalué el riesgo aceptado y la decisión sobre `sast`.

Verificación: revisé los logs completos de los runs 40966240874, 40970318956 y 41033690090. No acepté sugerencias a ciegas: descarté el SLO inicial de 100 ms al medir un segundo p95 y detecté en el log de k6 que el run #8 falló por `SLO_P95: <valor>`.
