# MejengaPool

Una reserva de cancha entre amigos suele depender de que una persona cobre las cuotas y asuma el faltante. En Costa Rica, esto puede pasar al organizar una *mejenga*: alguien aparta la cancha, pero algunos jugadores cancelan o no pagan a tiempo. Este proyecto usa un contrato de Soroban para que la regla de pago sea visible y comprobable.

> Proyecto individual de práctica. La pantalla web muestra datos ilustrativos; el contrato y sus pruebas son funcionales. Todo se hizo en Stellar Testnet con XLM de prueba, sin colones ni SINPE reales.

## La solución

Al desplegar el contrato se fijan el organizador, la cuenta de la cancha, el token, la meta y la hora límite. Cada jugador autoriza su aporte y el contrato guarda cuánto puso. Si se alcanza exactamente la meta, cualquiera puede llamar `pagar_cancha`; el contrato solo transfiere a la cuenta de la cancha. Si vence el plazo sin alcanzar la meta, cada jugador puede llamar `reembolsar` para recuperar **su propio aporte**. El reembolso se reclama; no se envía automáticamente.

```text
Jugador → aportar → contrato
                        ├─ meta completa → pagar_cancha → cancha
                        └─ plazo vencido y meta incompleta → reembolsar → jugador
```

Elegí este problema porque es fácil de reconocer y deja practicar las piezas esenciales de un contrato: autorización, transferencias de token, almacenamiento, tiempo del ledger y pruebas de errores. No es la idea de la hackathon.

## Probar el contrato localmente

Requisitos: Rust/Cargo, Stellar CLI y el target `wasm32v1-none`. En esta computadora ya están instalados.

Desde la raíz de este proyecto:

```powershell
cargo test --locked --offline
stellar contract build --locked
```

Si probás en otra computadora sin las dependencias descargadas, ejecutá `cargo test --locked` con conexión a internet. El segundo comando genera `target/wasm32v1-none/release/mejenga_pool.wasm`.

**Resultado comprobado localmente el 25 de noviembre de 2026:** `5 passed; 0 failed`. Los casos son:

| Prueba | Qué comprueba |
| --- | --- |
| `meta_completa_y_pago_unico` | La cancha recibe el total y no puede cobrarse dos veces. |
| `no_paga_si_falta_plata` | Un aporte parcial no permite pagar. |
| `devuelve_aporte_al_vencer` | Al vencer, el jugador recupera su saldo una sola vez. |
| `no_devuelve_antes_del_plazo` | No hay reembolso antes del límite. |
| `valida_montos_y_plazo` | Se rechazan montos inválidos y aportes tardíos. |

Las pruebas usan un token de prueba del SDK y avanzan el tiempo del ledger en memoria; no necesitan una wallet ni red.

## Abrir la demo visual local

La interfaz no requiere instalar paquetes JavaScript. Desde la raíz del proyecto:

```powershell
py -m http.server 4173 --directory .
```

Abrí <http://localhost:4173/web/>. Si `py` no está disponible, podés usar `python -m http.server 4173 --directory .`. La pantalla toma como referencia la lista de partidos y el detalle blanco de la captura de FotMob compartida para esta tarea. Los nombres, el progreso `3 de 5` y los montos de esa pantalla son **ilustrativos**; el enlace al contrato sí apunta al despliegue real.

## Contrato de prueba en Stellar Testnet

- **Contrato:** [`CAETV2PAIABP5VDY3SGW3F6NNSUGVRD5HRXAVVUCUA6YDBJI4TZF7VXH`](https://stellar.expert/explorer/testnet/contract/CAETV2PAIABP5VDY3SGW3F6NNSUGVRD5HRXAVVUCUA6YDBJI4TZF7VXH)
- **Transacción de despliegue:** [ver en StellarExpert](https://stellar.expert/explorer/testnet/tx/3f5b720f6444c3952448163b54f1d09ff5242010dd7f770f11c18765d9679ded)
- **Organizador / alias local `ceshez`:** `GDXK3KSXBR4SYHJJMRF3EVQKRLZCH3CDSDAT2WJFJBK4IC2PXAMM3ZWL`
- **Cuenta de la cancha:** `GDNQ3VMW4VBHJ7PMP26YRRG4WWMEZPTQ52MBAH7N6A3M4LKR4FBU6AG3`
- **Token:** contrato del XLM nativo de Testnet `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- **Meta:** 50 XLM de prueba (`500000000` stroops).
- **Plazo:** 26 de noviembre de 2026, 19:00 hora de Costa Rica.

El botón **Ver contrato en Testnet** usa el ID público de `web/config.js`. El alias `ceshez` se creó para Testnet en una carpeta local separada del repositorio. No corresponde a una wallet de Mainnet ni al inicio de sesión de GitHub.

Para leer el estado desplegado desde esta computadora, desde la raíz del proyecto:

```powershell
$config = Resolve-Path '..\..\work\stellar-config'
stellar contract invoke --id CAETV2PAIABP5VDY3SGW3F6NNSUGVRD5HRXAVVUCUA6YDBJI4TZF7VXH --source ceshez --network testnet --config-dir $config -- estado
```

Si clonás el repositorio en otro equipo, creá tu propia identidad de Testnet con `stellar keys generate TU_ALIAS --network testnet --fund`; nunca copies una frase semilla al repositorio.

## Trustless Work

[Trustless Work](https://docs.trustlesswork.com/trustless-work) ofrece escrows en Soroban con roles, aprobaciones y liberación de fondos. Preparamos una **demostración complementaria** del mismo problema de confianza. Su escrow de una sola liberación será independiente de MejengaPool: el contrato de esta entrega contiene nuestra lógica de meta y reembolso, y no afirma ejecutar contratos de Trustless Work por dentro.

Para probar el flujo complementario se puede abrir el [BackOffice de Trustless Work](https://dapp.trustlesswork.com/) en Testnet, crear una reserva con un hito de confirmación de cancha y usar wallets de prueba para financiar, aprobar y liberar. El BackOffice permite usar la interfaz sin API key; la API para automatizar acciones requiere una clave de Testnet y una firma de la wallet correspondiente. La clave **no está guardada en este proyecto**. [Guía de desarrollo](https://docs.trustlesswork.com/trustless-work/introduction/developer-resources.md) · [Tipos de escrow](https://docs.trustlesswork.com/trustless-work/introduction/technology-overview/escrow-types).

El escrow complementario aún no se ha creado. Su ID se agregará a `web/config.js` cuando se complete la prueba desde una wallet autorizada. Hasta entonces, la interfaz abre el BackOffice y no presenta un escrow inexistente como desplegado.

## Archivos principales

- `contracts/mejenga-pool/src/lib.rs`: contrato original.
- `contracts/mejenga-pool/src/test.rs`: pruebas locales.
- `web/`: demo visual sin dependencias JavaScript.
- `web/config.js`: IDs públicos de Testnet, sin secretos.

## Publicación

El proyecto queda preparado para un repositorio de GitHub bajo `ceshez`, con todo en la rama `main`, **después de la revisión local**. No subas `target/`, la carpeta de identidades ni claves de Trustless Work. `.gitignore` excluye los archivos de entorno y artefactos de compilación.
