#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

fn preparar(meta: i128, limite: u64) -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.timestamp = 100);
    let admin = Address::generate(&env);
    let organizador = Address::generate(&env);
    let cancha = Address::generate(&env);
    let jugador = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(admin);
    let token_id = asset.address();
    let id = env.register(
        MejengaPool,
        (String::from_str(&env, "Mejenga de prueba"), &organizador, &cancha, &token_id, &meta, &limite, 10_u32),
    );
    token::StellarAssetClient::new(&env, &token_id).mint(&jugador, &meta);
    (env, id, token_id, cancha, jugador)
}

#[test]
fn meta_completa_y_pago_unico() {
    let (env, id, token_id, cancha, jugador) = preparar(50, 200);
    let client = MejengaPoolClient::new(&env, &id);
    let token = token::Client::new(&env, &token_id);
    let mint = token::StellarAssetClient::new(&env, &token_id);
    client.aportar(&jugador, &10);
    for _ in 0..4 {
        let otro = Address::generate(&env);
        mint.mint(&otro, &10);
        client.aportar(&otro, &10);
        assert_eq!(client.aporte_de(&otro), 10);
    }
    assert_eq!(client.aporte_de(&jugador), 10);
    assert_eq!(client.estado().recaudado, 50);
    assert_eq!(client.estado().jugadores, 5);
    client.pagar_cancha();
    assert_eq!(token.balance(&cancha), 50);
    assert_eq!(token.balance(&id), 0);
    assert!(client.estado().pagado);
    assert_eq!(client.try_pagar_cancha(), Err(Ok(Error::YaPagado)));
}

#[test]
fn no_paga_si_falta_plata() {
    let (env, id, _, _, jugador) = preparar(50, 200);
    let client = MejengaPoolClient::new(&env, &id);
    client.aportar(&jugador, &30);
    assert_eq!(client.try_pagar_cancha(), Err(Ok(Error::MetaNoAlcanzada)));
}

#[test]
fn devuelve_aporte_al_vencer() {
    let (env, id, token_id, _, jugador) = preparar(50, 200);
    let client = MejengaPoolClient::new(&env, &id);
    let token = token::Client::new(&env, &token_id);
    client.aportar(&jugador, &10);
    env.ledger().with_mut(|li| li.timestamp = 200);
    assert_eq!(client.reembolsar(&jugador), 10);
    assert_eq!(token.balance(&jugador), 50);
    assert_eq!(client.aporte_de(&jugador), 0);
    assert_eq!(client.estado().jugadores, 0);
    assert_eq!(client.try_reembolsar(&jugador), Err(Ok(Error::SinAporte)));
}

#[test]
fn no_devuelve_antes_del_plazo() {
    let (env, id, _, _, jugador) = preparar(50, 200);
    let client = MejengaPoolClient::new(&env, &id);
    client.aportar(&jugador, &10);
    assert_eq!(
        client.try_reembolsar(&jugador),
        Err(Ok(Error::PlazoNoVencido))
    );
}

#[test]
fn valida_montos_y_plazo() {
    let (env, id, _, _, jugador) = preparar(50, 200);
    let client = MejengaPoolClient::new(&env, &id);
    assert_eq!(
        client.try_aportar(&jugador, &0),
        Err(Ok(Error::MontoInvalido))
    );
    assert_eq!(
        client.try_aportar(&jugador, &51),
        Err(Ok(Error::MontoInvalido))
    );
    env.ledger().with_mut(|li| li.timestamp = 200);
    assert_eq!(
        client.try_aportar(&jugador, &10),
        Err(Ok(Error::PlazoVencido))
    );
}

#[test]
fn respeta_cupo_y_no_duplica_jugador() {
    let (env, id, token_id, _, jugador) = preparar(50, 200);
    let client = MejengaPoolClient::new(&env, &id);
    let mint = token::StellarAssetClient::new(&env, &token_id);
    client.aportar(&jugador, &1);
    client.aportar(&jugador, &1);
    for _ in 1..10 {
        let otro = Address::generate(&env);
        mint.mint(&otro, &1);
        client.aportar(&otro, &1);
    }
    assert_eq!(client.estado().jugadores, 10);
    let extra = Address::generate(&env);
    mint.mint(&extra, &1);
    assert_eq!(client.try_aportar(&extra, &1), Err(Ok(Error::CupoLleno)));
}
