# MejengaPool ⚽

## El problema que elegí

En Costa Rica es común organizar una mejenga y que una sola persona se encargue de cobrar la cancha. Si alguien no paga o se sale a última hora, esa persona termina cubriendo el faltante. Elegí este problema porque es cotidiano, fácil de explicar y se puede resolver con reglas pequeñas que todos puedan comprobar.

## Mi solución

Construí un contrato inteligente en **Soroban, la plataforma de contratos de Stellar**, para juntar la cuota de una cancha. Al crear una mejenga se fija una meta, un cupo de jugadores, una cuenta para pagar la cancha y una fecha límite. Cada jugador autoriza su aporte con su wallet. El contrato guarda cuánto ha aportado cada uno y no acepta más de lo que falta para la meta.

Si se completa la meta, se puede ejecutar el pago a la cuenta de la cancha una sola vez. Si vence el plazo sin completar la meta, cada jugador puede reclamar su propio aporte. **El reembolso hay que solicitarlo; no ocurre automáticamente.**

```text
Crear mejenga → Aportar → Meta completa → Pagar cancha
                        ↳ Vence el plazo → Cada jugador reclama su reembolso
```

Me basé en los conceptos que practicamos en las clases con Armando: contratos en Rust, `require_auth()` para autorizar al jugador, almacenamiento del estado, transferencias con `token::Client` y pruebas con un ledger de prueba. Mantuve el contrato pequeño para poder entender y comprobar cada regla.

## Cómo funciona el contrato

El contrato está en [`contracts/mejenga-pool/src/lib.rs`](contracts/mejenga-pool/src/lib.rs). Estas son sus funciones principales:

| Función | Qué hace |
| --- | --- |
| `__constructor` | Guarda nombre, organizador, cancha, token, meta, plazo y cupo. |
| `aportar` | Pide la autorización del jugador, valida monto, plazo y cupo, y transfiere su aporte al contrato. |
| `pagar_cancha` | Transfiere la meta a la cancha solo cuando está completa y evita pagar dos veces. |
| `reembolsar` | Después del plazo, devuelve a un jugador exactamente su aporte si la meta no se alcanzó. |
| `estado` y `aporte_de` | Permiten consultar el estado general y el aporte de una wallet. |

El contrato usa el token que se indique al crearlo. La instancia de ejemplo que desplegué en **Stellar Testnet** usa XLM de prueba, con meta de 1000 XLM y cupo de 10 jugadores: [ver contrato en StellarExpert](https://stellar.expert/explorer/testnet/contract/CDE3GNV7QZK6IDZWR6LODBDUBVOBHVBKZS6MTAI3H4NBXWNOHYMY4ZE3).

## Demo visual con Trustless Work

También hice una interfaz para probar la idea de una mejenga con un **escrow de Trustless Work en USDC de Testnet**. Usé [Stellar Wallets Kit](https://stellarwalletskit.dev/) para conectar y firmar desde la wallet. Al crear un partido se piden los dos equipos, meta, cupo, fecha límite y cuenta de la cancha. El servidor solicita a la API de Trustless Work una transacción sin firmar, la wallet la firma y Trustless Work la envía. La lista consulta los escrows y cambia el detalle cuando elijo otro partido.

**Esta demo de USDC y mi contrato Soroban de XLM son contratos distintos.** Los aportes hechos en la interfaz van al escrow de Trustless Work, no al contrato Soroban de la tarea. Llegar a la meta tampoco libera automáticamente el USDC: las personas con los roles correspondientes deben aprobar el hito y liberar el pago en [Trustless Work BackOffice](https://dapp.trustlesswork.com/dashboard).

El cupo, la fecha límite y el máximo restante se validan en esta aplicación. Trustless Work también permite depósitos directos al escrow desde fuera de la aplicación; por eso **no digo que esas tres reglas estén garantizadas por el contrato de Trustless Work**. El contador de jugadores muestra las wallets que aportaron mediante este servidor local. En cambio, el contrato Soroban que programé sí valida meta, cupo y plazo dentro del contrato.

## Cómo correrlo localmente

Node.js 20 o superior. Para probar el contrato también necesitas Rust, Cargo, Stellar CLI y el target de Soroban. Desde la raíz del repositorio ejecuta:

```powershell
npm install
Copy-Item .env.example .env
# Abre .env y coloca tu propia clave de Trustless Work Testnet
npm run dev
```

Después abre **http://127.0.0.1:4173/web/**. Para conseguir una clave se puede seguir la [guía oficial de Trustless Work](https://docs.trustlesswork.com/trustless-work/introduction/developer-resources/request-api-key).

Para crear un partido conecta una wallet de **Testnet**, pulsa **+ Crear mejenga**, completa el formulario y confirma la firma. La nueva mejenga se agrega a la lista y se abre en el detalle. Puedo cambiar de partido pulsando otra fila. Para aportar necesito una [trustline de USDC Testnet y USDC de prueba](https://docs.trustlesswork.com/trustless-work/introduction/stellar-and-soroban-the-backbone-of-trustless-work/testnet-tokens), además de algo de XLM de prueba para la comisión. El formulario no deja ingresar más de lo que falta y el servidor vuelve a comprobarlo antes de enviar la transacción.

Para buscar un escrow en el [dashboard de Trustless Work](https://dapp.trustlesswork.com/dashboard) selecciona **Testnet** y conecta la **misma wallet con la que lo creaste**. También puedes copiar el ID de la página y pegarlo en el [Escrow Viewer](https://viewer.trustlesswork.com/). El escrow inicial de prueba es de **1 USDC** y tiene ID `CADIYI2MPDEMH7EBYSAMDKC5E44FN4FIQ4EBXJB2R234WIVIKVNOKZ4Z`. La meta de **1000 USDC** que aparece en el formulario es una sugerencia; el escrow nuevo solo existe después de confirmar la firma.

## Pruebas que hice

Para ejecutar las pruebas del contrato:

```powershell
cargo test --locked
stellar contract build --locked
```

El resultado de `cargo test` fue **6 passed; 0 failed**. Probé estos casos:

| Prueba | Resultado esperado |
| --- | --- |
| Meta completa y pago único | Cinco wallets completan la meta; la cancha cobra una vez. |
| Pago antes de la meta | El contrato rechaza el pago. |
| Reembolso después del plazo | El jugador recupera lo que aportó y no puede cobrar dos veces. |
| Reembolso antes del plazo | El contrato lo rechaza. |
| Montos y fecha | Rechaza cero, un aporte que supera la meta y un aporte tardío. |
| Cupo | Una wallet nueva no entra cuando el cupo está lleno; una wallet existente no cuenta dos veces. |

Las pruebas están en [`contracts/mejenga-pool/src/test.rs`](contracts/mejenga-pool/src/test.rs) y usan el token de prueba del SDK y un ledger en memoria. También comprobé que la API de Trustless Work devuelve el escrow de prueba, que puede preparar una creación sin firmarla y que mi servidor rechaza un aporte superior al saldo restante. **La creación y el aporte completos desde una wallet requieren confirmar la firma manualmente.**

## Archivos principales

- `contracts/mejenga-pool/`: contrato y pruebas.
- `web/index.html`, `web/styles.css` y `web/tw.js`: interfaz de partidos y wallet.
- `server.mjs`: servidor local que habla con la API de Trustless Work.
- `.env.example`: ejemplo de configuración.
