# MejengaPool

En Costa Rica, organizar una mejenga suele dejar a una persona cobrando la cuota de la cancha. Este proyecto permite crear un escrow en **Trustless Work sobre Stellar Testnet** y recibir aportes de **USDC de prueba**. La interfaz muestra el saldo, la meta, la cancha y los equipos de cada partido. Es una práctica individual, no una propuesta para la hackathon.

## Qué hace

1. El organizador conecta una wallet de Testnet y crea una mejenga con dos equipos, meta de USDC, cuenta de la cancha, cupo y fecha límite. La app pide una firma y crea un **escrow single-release de Trustless Work**. La meta puede ser, por ejemplo, **1000 USDC de prueba**.
2. Cada jugador conecta su wallet y firma un aporte. El servidor usa la clave de `.env` para pedir a Trustless Work una transacción sin firmar; la clave privada nunca pasa por la app. Tras la firma, Trustless Work envía la transacción.
3. La lista consulta los escrows del organizador. Al elegir otro partido, el detalle cambia sus equipos, meta, saldo, cuenta receptora y plazo. El dashboard de Trustless Work permite revisar el escrow con la **misma wallet organizadora** en **Testnet**.
4. El organizador gestiona el hito, la aprobación y la liberación del pago desde [Trustless Work BackOffice](https://dapp.trustlesswork.com/dashboard). **Llegar a la meta no libera automáticamente el dinero**.

La sección `contracts/mejenga-pool/` contiene además el contrato Soroban escrito para la tarea. Sus seis pruebas ejercitan aporte, límite, cupo, pago y reembolso. **Ese contrato de práctica es distinto de los escrows de Trustless Work**. La interfaz principal ahora mueve USDC mediante Trustless Work, no XLM mediante ese contrato.

## Probar localmente

Requisitos: Node.js 20+, una wallet compatible con Stellar Wallets Kit configurada en Testnet y, para probar el contrato de la tarea, Rust, Cargo y Stellar CLI.

```powershell
cd C:\Users\carlo\Documents\Codex\2026-11-25\ho\outputs\mejenga-pool
npm install
npm run dev
```

Abrí **http://127.0.0.1:4173/web/**. No abras `web/index.html` como `file://`. En esta computadora, si PowerShell no resuelve `npm`, ejecutá `node server.mjs` tras instalar dependencias.

En `.env` debe existir `TRUSTLESS_WORK_API_KEY=...`. El archivo está excluido de Git y el navegador no recibe la clave. La API usa `https://dev.api.trustlesswork.com` (Testnet). Para aportar USDC de prueba necesitás una [trustline USDC Testnet y tokens del faucet](https://docs.trustlesswork.com/trustless-work/introduction/stellar-and-soroban-the-backbone-of-trustless-work/testnet-tokens). Para las comisiones de red necesitás XLM de prueba. El emisor USDC Testnet documentado por Trustless Work es `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`.

### Probar la creación y el aporte

1. Pulsá **Conectar wallet** y elegí Testnet. Si usás `ceshez`, su dirección pública termina en `M3ZWL`.
2. Pulsá **+ Crear mejenga**, ingresá los dos equipos, una meta como `1000`, cupo `10`, cuenta pública de la cancha y plazo. Firmá la creación en la wallet. La nueva fila se selecciona y su detalle se actualiza.
3. Seleccioná otra fila para comprobar que nombres, saldo, meta, receptor y progreso cambian. El enlace **Ver escrow en Testnet** abre el contrato seleccionado.
4. Ingresá un aporte menor o igual al saldo restante. Confirmá la firma. La app vuelve a consultar Trustless Work para actualizar el saldo. Podés copiar el ID del escrow y pegarlo en el [Escrow Viewer](https://viewer.trustlesswork.com/) en Testnet.
5. Abrí el [dashboard](https://dapp.trustlesswork.com/dashboard), elegí **Testnet** y conectá la **misma wallet que firmó la creación**. El dashboard consulta escrows por los roles de esa cuenta. Si aún no se ve, usá el ID en el Viewer y revisá los filtros de rol y estado del dashboard.

El escrow anterior de prueba, `CADIYI2MPDEMH7EBYSAMDKC5E44FN4FIQ4EBXJB2R234WIVIKVNOKZ4Z`, es de **1 USDC** con saldo inicial **0**. No es la mejenga de 1000. Esa meta es un valor propuesto en el formulario; hay que firmar su creación para que exista en Trustless Work.

### Límites importantes

La interfaz y el servidor rechazan un aporte mayor que el saldo restante. El servidor vuelve a consultar el saldo antes de enviar una firma. El cupo y el plazo se guardan en la descripción del escrow y se validan **en esta aplicación**. El contador muestra wallets que aportaron mediante este servidor local; aportes directos desde otras aplicaciones no aparecen en ese contador.

**Trustless Work permite depósitos directos al escrow sin aplicar estos límites de MejengaPool en cadena.** Por ello, no se debe presentar la meta, el cupo o el plazo como un límite absoluto del contrato de Trustless Work. El contrato Soroban propio sí comprueba su meta, cupo y plazo en cadena, pero no procesa los aportes USDC de la interfaz actual. Para imponer un límite absoluto en el flujo de Trustless Work haría falta otro diseño de contrato y una integración verificada.

## Pruebas del contrato Soroban

```powershell
cargo test --locked --offline
stellar contract build --locked
```

Las seis pruebas incluidas cubren pago único al completar la meta, rechazo de pago anticipado, reembolso tras el plazo, rechazo de reembolso temprano, validación de monto y plazo, y cupo sin duplicar jugadores. El contrato de práctica desplegado previamente puede verse en [StellarExpert Testnet](https://stellar.expert/explorer/testnet/contract/CDE3GNV7QZK6IDZWR6LODBDUBVOBHVBKZS6MTAI3H4NBXWNOHYMY4ZE3).

## Archivos

- `server.mjs`: guarda la clave API en el servidor, consulta escrows y solicita transacciones sin firmar a Trustless Work.
- `web/tw.js`: wallet, selección de partidos, creación y aportes USDC.
- `web/index.html` y `web/styles.css`: interfaz.
- `contracts/mejenga-pool/`: contrato Soroban de la práctica y pruebas.

El trabajo está en la rama local `main`. Probá la demo antes de publicarla en GitHub. `.env`, dependencias, datos locales de contribuyentes y compilados están excluidos de Git.
