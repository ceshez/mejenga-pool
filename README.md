# MejengaPool

Organizar una mejenga en Costa Rica suele dejarle a una persona el cobro de la cancha. Si varios jugadores no pagan, esa persona asume el faltante. MejengaPool fija la meta, el cupo y el plazo en un contrato de Stellar Testnet para que cada aporte y la regla de pago sean verificables.

> Proyecto individual de práctica. Usa XLM de Testnet sin valor monetario. La pantalla toma como referencia la lista y el detalle blanco de FotMob; los escudos de la demo fueron aportados para esta tarea.

## Cómo funciona

1. El organizador crea un contrato con nombre, cuenta de la cancha, meta en XLM, cupo y fecha límite.
2. Cada jugador conecta su wallet con **Stellar Wallets Kit**, firma y aporta XLM de Testnet. El contrato registra su aporte y cuenta las wallets participantes.
3. Al alcanzar exactamente la meta, cualquiera puede ejecutar `pagar_cancha`; el destino está fijado en el contrato.
4. Si vence el plazo sin alcanzar la meta, cada jugador puede ejecutar `reembolsar` para recuperar su propio saldo. El reembolso no es automático.

El contrato rechaza montos mayores que lo que falta, aportes fuera de plazo y participantes nuevos cuando el cupo está lleno. Una wallet que ya aportó puede aumentar su aporte mientras la reserva siga abierta.

Elegí este problema porque permite practicar autorización, transferencias de token, almacenamiento y tiempo del ledger con una situación cotidiana. No es la idea de la hackathon.

## Probarlo localmente

Requisitos: Node.js 20 o superior, Rust, Cargo, Stellar CLI y el target `wasm32v1-none`.

```powershell
cd C:\Users\carlo\Documents\Codex\2026-11-25\ho\outputs\mejenga-pool
npm install
npm run dev
```

Abrí **http://127.0.0.1:4173/web/**. La página consulta el estado real del contrato en Testnet. El botón del encabezado abre el selector de Stellar Wallets Kit. Elegí una wallet configurada en **Testnet** y con XLM de prueba para aportar. La wallet debe confirmar cada transacción; ninguna clave privada se introduce en la página.

En esta computadora, si PowerShell no encuentra el ejecutable correcto de `npm`, usá:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' install
node server.mjs
```

Para crear otra mejenga, abrí **+ Crear mejenga**, ingresá la cuenta pública de la cancha, la meta, el cupo y el plazo, y aprobá la firma. El formulario despliega una **nueva instancia real** del mismo WASM en Testnet. El enlace a la instancia activa aparece en el detalle. Las instancias creadas quedan en la lista de este navegador y se pueden compartir con la URL `?contract=ID`.

Si la wallet no tiene fondos de prueba, obtenelos con [Friendbot](https://friendbot.stellar.org/). En Testnet también se pagan pequeñas comisiones con XLM de prueba. El botón **Aportar en Testnet** solicita la firma, envía la transacción y actualiza el monto y la barra después de la confirmación. **Pagar a la cancha** y **Reclamar mi reembolso** aparecen solo cuando sus condiciones se cumplen.

## Pruebas del contrato

```powershell
cargo test --locked --offline
stellar contract build --locked
```

El 25 de noviembre de 2026 pasaron **6 pruebas**:

| Prueba | Comportamiento |
| --- | --- |
| `meta_completa_y_pago_unico` | Cinco wallets completan la meta; la cancha cobra una vez y el contador marca cinco. |
| `no_paga_si_falta_plata` | No se paga antes de alcanzar la meta. |
| `devuelve_aporte_al_vencer` | El jugador recupera su aporte una vez y el contador baja. |
| `no_devuelve_antes_del_plazo` | No hay reembolso antes del límite. |
| `valida_montos_y_plazo` | Se rechazan montos inválidos y aportes tardíos. |
| `respeta_cupo_y_no_duplica_jugador` | El cupo impide un jugador nuevo, y aportar dos veces no duplica el contador. |

Las pruebas usan un token de prueba del SDK y un ledger en memoria. Además, se simuló en Stellar Testnet una creación y un aporte con Stellar SDK; ambas simulaciones fueron exitosas. **La firma y el envío desde una wallet de navegador requieren la confirmación de esa wallet** y se prueban manualmente con XLM de Testnet.

## Contrato desplegado

- [Mejenga demo de 1000 XLM en StellarExpert](https://stellar.expert/explorer/testnet/contract/CDE3GNV7QZK6IDZWR6LODBDUBVOBHVBKZS6MTAI3H4NBXWNOHYMY4ZE3)
- [Transacción de despliegue](https://stellar.expert/explorer/testnet/tx/a289b71cb07cf268e6248d5e3645b7576593dfd04a820349cfbaa563197156d6)
- Organizador: `GDXK3KSXBR4SYHJJMRF3EVQKRLZCH3CDSDAT2WJFJBK4IC2PXAMM3ZWL`
- Cuenta de la cancha: `GDNQ3VMW4VBHJ7PMP26YRRG4WWMEZPTQ52MBAH7N6A3M4LKR4FBU6AG3`
- Token: XLM nativo de Testnet, `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Meta: **1000 XLM de prueba**; cupo: **10**; cierre: **26 de noviembre de 2026 a las 19:00, Costa Rica**.

El contrato anterior de 50 XLM sigue disponible en [StellarExpert](https://stellar.expert/explorer/testnet/contract/CAETV2PAIABP5VDY3SGW3F6NNSUGVRD5HRXAVVUCUA6YDBJI4TZF7VXH). La nueva versión agrega nombre, cupo y contador; la interfaz usa la nueva instancia.

## Trustless Work

La clave de Trustless Work se lee **solo** desde `.env` en el servidor local. Nunca se incluye en el JavaScript entregado al navegador ni en Git. La página muestra si está configurada y ofrece el [BackOffice de Testnet](https://dapp.trustlesswork.com/).

**Estado actual:** la reserva y los aportes funcionales de esta entrega usan el contrato Soroban propio. Aún no se creó un escrow complementario de Trustless Work ni aparecerá una mejenga en ese dashboard solo por guardar la API key. Trustless Work requiere solicitar un XDR, firmarlo con una wallet de rol y enviarlo a Testnet. Esta separación evita mostrar un escrow inexistente como creado. [Documentación de Trustless Work](https://docs.trustlesswork.com/trustless-work) · [API REST](https://docs.trustlesswork.com/trustless-work/api-rest/introduction).

## Archivos y publicación

- `contracts/mejenga-pool/src/lib.rs`: contrato Soroban.
- `contracts/mejenga-pool/src/test.rs`: pruebas locales.
- `web/`: interfaz y escudos.
- `web/config.js`: IDs y direcciones **públicas** de Testnet.
- `server.mjs`: servidor local, proxy de RPC y detección de la clave de Trustless Work.

El trabajo está en la rama local `main`. Revisá la demo local antes de publicarlo en GitHub. `.gitignore` excluye `.env`, `node_modules/`, `target/` y los archivos de identidad; nunca publiques claves secretas.
