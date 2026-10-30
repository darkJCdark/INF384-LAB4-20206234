# Respuestas · Laboratorio 4
Alumno: 20206234
Presupuesto: 11 min  Métrica DORA: time to restore

## Parte 1 · Diagnóstico

## Parte 1 · Diagnóstico

### Defecto 1
- Job y etapa: `load`, post-deploy (`.github/workflows/ci.yml`).
- Problema que causa en el pipeline: corre en todo evento (pull request, push y manual) y dura 12 min 16 s (1+10+1 min de stages en `test/load/transferir.js`). Es el 77 % de los 15 min 59 s sumados del pipeline: retrasa la retroalimentación de cada PR y satura con 30 usuarios virtuales la Lambda compartida con los despliegues de otros PRs.
- Link al commit: https://github.com/darkJCdark/INF384-LAB4-20206234/commit/428f91d309a348669d9a39388d4709d33f297b47
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): ajustar configuración (`if: github.ref == 'refs/heads/main'`; deja de correr en pull requests).
- Evidencia (dato observado, con link al run o fragmento de la salida local): run base https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40956851525, job `load` = 12 min 16 s (736 s) de 959 s sumados (77 %).

### Defecto 2
- Job y etapa: `smoke`, etapa deploy (`needs: build-push`); debía estar en post-deploy.
- Problema que causa en el pipeline: arranca en paralelo con `deploy`, por lo que puede probar la versión anterior de la Lambda. Además no pasa `EXPECTED_COMMIT`, que `smoke.sh` ya soporta, así que aprueba aunque responda otro commit. `e2e` y `load` heredan el problema porque dependen de `smoke`.
- Link al commit: https://github.com/darkJCdark/INF384-LAB4-20206234/commit/3511b5e122f3376cd38a363b5b49f7b475726afe
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): mover de etapa (`needs: deploy`) y ajustar configuración (`EXPECTED_COMMIT: ${{ github.sha }}`).
- Evidencia (dato observado, con link al run o fragmento de la salida local): run base .../runs/40956851525: `deploy` inició a las 21:21:13 GMT y duró 22 s; `smoke` inició a las 21:21:19 GMT, con `deploy` aún en ejecución. El paso `Smoke` imprime solo `salud:` y `saldo:`, sin ninguna línea `commit:`, es decir, no verificó el commit. Tras la corrección, el run https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40966240874 muestra `build-push → deploy → smoke` en secuencia.

### Defecto 3
- Job y etapa: workflow completo (`ci.yml`, nivel workflow; no pertenece a un job).
- Problema que causa en el pipeline: sin `concurrency`, dos ejecuciones seguidas lanzan dos pipelines completos sobre la misma Lambda (unos 16 min de jobs cada uno). Un run puede redesplegar la función mientras el otro ejecuta `smoke`, `e2e` o `load` contra ella, y los resultados dejan de corresponder al commit probado.
- Link al commit: https://github.com/darkJCdark/INF384-LAB4-20206234/commit/f13fbdef02c46efe87a1c033370e018e62dd05f5
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): ajustar configuración (`concurrency` por rama; cancela los runs obsoletos de pull requests).
- Evidencia (dato observado, con link al run o fragmento de la salida local): dos ejecuciones lanzadas seguidas sobre `main`, ambas `In progress` a la vez: https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40962204030 y https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40962216638 (canceladas a mano).

### Defecto 4
- Job y etapa: `integration`, pre-build (`test/integration/transferir.test.js`).
- Problema que causa en el pipeline: las pruebas están encadenadas sobre una sola base. "el saldo de beto refleja el credito" espera 600 porque la primera prueba transfirió 100 sobre el saldo semilla de 500. El resultado depende del orden: una prueba aislada, o una segunda corrida con el mismo `DB_PATH`, falla sin defecto real, y no se pueden reordenar ni paralelizar.
- Link al commit: https://github.com/darkJCdark/INF384-LAB4-20206234/commit/dabcd67d0072a8eabde44dc7daf5b24ae21ebe18
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): modificar tests (base SQLite propia por prueba mediante `DB_PATH` en `beforeEach`).
- Evidencia (dato observado, con link al run o fragmento de la salida local): log del job `integration` del run base https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40956851525: `# tests 12`, ejecutadas en orden fijo; el 600 esperado en la tercera prueba solo existe si corrió antes la primera (líneas 14 a 27 del archivo original). Tras la corrección, el run .../runs/40966240874 ejecuta `# tests 8`, `# pass 8`, `# fail 0`, cada una con su propia base.

### Defecto 5
- Job y etapa: `e2e`, post-deploy (`test/e2e/api.spec.ts`).
- Problema que causa en el pipeline: 9 de las 10 pruebas son llamadas HTTP sin navegador (nivel de integración) y repiten lo que ya cubren `smoke` e integración. Dos no verifican nada: `saldo >= 0` siempre se cumple por el `CHECK` de la tabla, y el bucle sobre el historial pasa con la lista vacía. El job paga 36 s de instalación de Chromium para pruebas que tardan 4,3 s. E2E debe reservarse a recorridos críticos.
- Link al commit: https://github.com/darkJCdark/INF384-LAB4-20206234/commit/f3036fb04e0a0226b1e7eddff3935eeb6b8ec0e8
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): eliminar (8 pruebas) y modificar tests (se conservan la transferencia por la URL pública y la lectura en navegador).
- Evidencia (dato observado, con link al run o fragmento de la salida local): run base .../runs/40956851525, job `e2e`: paso `Navegador` = 36 s de 1 min 1 s del job; paso `Playwright`: `10 passed (4.3s)`. Solo la prueba 4 usa navegador; las otras 9 usan `page.request`.

## Parte 2 · Implementación
- Link al run en verde en main: https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40966240874 (ejecución manual sobre main, commit f3036fb; su historial contiene los cinco commits de la Parte 1: 428f91d, 3511b5e, f13fbde, dabcd67 y f3036fb; todos los jobs en verde, 13 min 58 s).
- Link al pull request: https://github.com/darkJCdark/INF384-LAB4-20206234/pull/1 (defecto/saldo-exacto → main del fork; abierto, sin merge).
- Defecto de la aplicación introducido (archivo y descripción): `src/wallet.js`, función de transferencia, línea 54 (commit e7c566d, https://github.com/darkJCdark/INF384-LAB4-20206234/commit/e7c566d125f7b2098a774bd0ae4e79d6bd9a2e23). La condición `if (cuentaOrigen.saldo < centimos)` pasó a `<=`. Una transferencia por el saldo exacto del origen (por ejemplo, diego envía sus 300 soles a elena) se rechaza con HTTP 400 "saldo insuficiente", aunque el origen tiene fondos justos.
- Job que debería detenerlo: `unit`. La prueba "transferir todo el saldo deja el origen en cero" (`test/unit/wallet.test.js`, línea 53) espera que el origen quede en 0 y recibe el error "saldo insuficiente" lanzado en `src/wallet.js:55`; el job termina con 27 de 28 pruebas aprobadas y código de salida 1. `integration` también lo detecta: "diego transfiere todo su saldo a elena y despues no puede transferir" recibe 400 en lugar de 200, y "el historial de elena muestra solo la transferencia de diego" encuentra 0 movimientos en lugar de 1 (6 de 8 pruebas aprobadas). Al fallar ambos, `build-push` no se ejecuta y no hay despliegue.
- Link al run fallido: https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40970318956 (evento pull_request del PR #1; `unit` en rojo a los 11 s e `integration` en rojo a los 14 s; `build-push`, `deploy`, `smoke`, `e2e` y `load` no se ejecutaron; run total de 28 s).

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
| **Total** | 15:03 (suma de jobs; 13 min 58 s de reloj) |

Resultado de load en ese run:
| Métrica | Valor |
|---|---|
| p90 | 49,26 ms |
| p95 | 51,32 ms |
| Máximo | 167,27 ms |
| Tasa de error | 0,00 % (0 de 36 514 requests) |
| Requests por segundo | 50,64 |

Conclusión sobre el comportamiento bajo carga: con 30 VUs durante 12 min (36 514 requests, 100 % de checks) la función responde estable: p95 51,32 ms frente al umbral de 500 ms (10 veces de margen) y máximo 167,27 ms, sin degradación visible. Dos límites de la prueba: la tasa de error de 0,00 % no incluye los rechazos 400, que el script declara como esperados, y los 50 rps los fija el `sleep(1)` de cada VU, no la capacidad de la función; por eso el test confirma estabilidad a esa carga pero no mide el límite de capacidad.

SLO propuesto (percentil, valor, ventana) y justificación: p95 de `http_req_duration` < 150 ms, medido sobre la ventana completa de la corrida de k6 (30 VUs; 6 min con 4 min de stage constante). Configurado en `SLO_P95: 150` de `ci.yml` (commit c1aca30). El run medido dio p95 = 51,32 ms (p90 = 49,26 ms), pero un segundo run con el mismo test (run #8 de `ci`, disparado por el commit 89c09c4) dio p95 = 81,18 ms y mínimo de 69,73 ms frente a 30,72 ms: la latencia base varió unos 39 ms entre runs sin cambiar la aplicación. Un SLO de 100 ms habría dejado solo 18,8 ms de holgura sobre el peor valor observado y haría fallar `load` por variación normal; 150 ms deja 1,85 veces de holgura sobre el peor valor y sigue siendo 3,3 veces más estricto que el umbral original de 500 ms, que no detectaba degradaciones de hasta 9 veces.

SLA propuesto y diferencia con el SLO: disponibilidad mensual de al menos 99,5 % (respuestas sin error 5xx) y p95 de latencia ≤ 500 ms medido mensualmente, con compensación al cliente si no se cumple. El SLO (150 ms) es una meta interna que el equipo se exige y verifica en cada run; el SLA es un compromiso con consecuencias contractuales y por eso se fija más holgado (500 ms): entre ambos queda un margen para que un incidente consuma presupuesto de error interno antes de incumplir lo prometido al cliente.

Cambios para cumplir el presupuesto:
| Cambio | Job | Minutos recuperados |
|---|---|---|
| Stage de carga constante de k6 de 10 min a 4 min en `test/load/transferir.js` (commit 89c09c4); `load` sigue corriendo en cada run en main y evalúa `SLO_P95` | load | 6 min 3 s (de 12:12 a 6:09) |

Total resultante: 9 min 00 s (540 s, suma de jobs: 14 + 11 + 21 + 17 + 33 + 19 + 12 + 44 + 369 s), 2 min por debajo del presupuesto de 11 min; 7 min 55 s de reloj.
Link al run en main con los cambios: https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/41033690090 (run #9, push a main, commit c1aca30, verde).

Riesgo aceptado (defecto de la aplicación concreto y efecto en la métrica DORA asignada): defecto en `src/db.js`, consulta `leerMovimientos` (líneas 41 a 47): eliminar `LIMIT 50`. `GET /historial/{usuario}` pasaría a devolver todos los movimientos acumulados en lugar de los últimos 50; cada transferencia agrega una fila (el run #8 ejecutó 7 854 transferencias en 6 min), por lo que el tamaño de la respuesta, la memoria y la latencia crecen sin tope hasta acercarse al timeout de 15 s de la función. El pipeline resultante no lo detecta: `unit` usa un store falso, `integration` crea una base propia por prueba con un solo movimiento, `e2e` y `smoke` no consultan `/historial` y `load` solo llama a `/transferir` y `/saldo`, y además ahora acumula 4 min de carga en lugar de 10 (menos movimientos acumulados, de modo que el efecto tardaría más en notarse aunque `load` consultara el historial). Se acepta porque el endpoint no está en el camino crítico de la transferencia y cubrirlo exigiría ampliar `load` o agregar una prueba con más de 50 movimientos, fuera del alcance de este cambio. Efecto en time to restore: sube. El defecto llega a producción y se detecta por sus efectos (latencia, timeouts), no antes del despliegue, así que el tiempo hasta detectarlo se suma al tiempo de restauración. El acortamiento de `load` solo reduce el peor caso de espera de un commit de corrección: como el workflow no cancela runs de push en curso (`cancel-in-progress` solo en pull request), un hotfix puede quedar en cola detrás de un run activo, que antes tardaba hasta 13 min 58 s y ahora hasta 7 min 55 s; la corrección llega a `deploy` unos 66 s después de iniciar su run (unit 14 s + build-push 33 s + deploy 19 s).

Decisión sobre sast (se queda / se mueve a otra etapa o evento / informativo) y razón: se queda como job bloqueante en la etapa pre-build. Su costo en el run #9 fue 21 s (0,35 min), el 3,9 % de la suma de 540 s; corre en paralelo con `unit`, `integration` y `sca`, así que solo agrega 4 s al camino antes de `build-push` (21 s frente a los 17 s de `sca`, el siguiente más lento). El presupuesto ya se cumple con 2 min de margen, de modo que quitarlo no hace falta para cumplirlo. Efecto en time to restore: no cambia en la práctica (unos 4 s más hasta `deploy`), mientras que moverlo después del despliegue o dejarlo informativo permitiría que una vulnerabilidad de severidad ERROR llegue a producción y obligaría a restaurar con un nuevo run.

## Declaración de uso de IA
Herramientas usadas y para qué:
