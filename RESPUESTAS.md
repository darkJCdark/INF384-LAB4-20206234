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
- Job que debería detenerlo: `unit`. La prueba "transferir todo el saldo deja el origen en cero" espera saldo 0 en el origen y recibe el error. `integration` también lo detecta (transferencia de todo el saldo de diego a elena). Al fallar ambos, `build-push` no se ejecuta y no hay despliegue.
- Link al run fallido: https://github.com/darkJCdark/INF384-LAB4-20206234/actions/runs/40970318956 (evento pull_request del PR #1; `unit` en rojo a los 11 s e `integration` en rojo a los 14 s; `build-push`, `deploy`, `smoke`, `e2e` y `load` no se ejecutaron; run total de 28 s).

## Parte 3 · Decisión bajo restricción
Link al run medido:

| Job | Duración (min:seg) |
|---|---|
| unit | |
| integration | |
| sast | |
| sca | |
| build-push | |
| deploy | |
| smoke | |
| e2e | |
| load | |
| **Total** | |

Resultado de load en ese run:
| Métrica | Valor |
|---|---|
| p90 | |
| p95 | |
| Máximo | |
| Tasa de error | |
| Requests por segundo | |

Conclusión sobre el comportamiento bajo carga:

SLO propuesto (percentil, valor, ventana) y justificación:

SLA propuesto y diferencia con el SLO:

Cambios para cumplir el presupuesto:
| Cambio | Job | Minutos recuperados |
|---|---|---|

Total resultante: [ ] min
Link al run en main con los cambios:

Riesgo aceptado (defecto de la aplicación concreto y efecto en la métrica DORA asignada):

Decisión sobre sast (se queda / se mueve a otra etapa o evento / informativo) y razón:

## Declaración de uso de IA
Herramientas usadas y para qué:
