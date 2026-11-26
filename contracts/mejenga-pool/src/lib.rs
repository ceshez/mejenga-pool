#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Mejenga {
    pub nombre: String,
    pub organizador: Address,
    pub cancha: Address,
    pub token: Address,
    pub meta: i128,
    pub recaudado: i128,
    pub limite: u64,
    pub pagado: bool,
    pub cupo: u32,
    pub jugadores: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum Clave {
    Mejenga,
    Aporte(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    ParametrosInvalidos = 1,
    PlazoVencido = 2,
    MontoInvalido = 3,
    MetaNoAlcanzada = 4,
    PlazoNoVencido = 5,
    SinAporte = 6,
    YaPagado = 7,
    MetaAlcanzada = 8,
    CupoLleno = 9,
}

#[contract]
pub struct MejengaPool;

#[contractimpl]
impl MejengaPool {
    pub fn __constructor(
        env: Env,
        nombre: String,
        organizador: Address,
        cancha: Address,
        token: Address,
        meta: i128,
        limite: u64,
        cupo: u32,
    ) {
        if nombre.len() == 0 || nombre.len() > 40 || meta <= 0 || limite <= env.ledger().timestamp() || organizador == cancha || cupo < 2 || cupo > 100 {
            soroban_sdk::panic_with_error!(&env, Error::ParametrosInvalidos);
        }
        let mejenga = Mejenga {
            nombre,
            organizador,
            cancha,
            token,
            meta,
            recaudado: 0,
            limite,
            pagado: false,
            cupo,
            jugadores: 0,
        };
        env.storage().instance().set(&Clave::Mejenga, &mejenga);
    }

    pub fn aportar(env: Env, jugador: Address, monto: i128) -> Result<(), Error> {
        jugador.require_auth();
        let mut mejenga = Self::estado(env.clone());
        if mejenga.pagado {
            return Err(Error::YaPagado);
        }
        if env.ledger().timestamp() >= mejenga.limite {
            return Err(Error::PlazoVencido);
        }
        if mejenga.recaudado == mejenga.meta {
            return Err(Error::MetaAlcanzada);
        }
        if monto <= 0 || monto > mejenga.meta - mejenga.recaudado {
            return Err(Error::MontoInvalido);
        }

        let clave = Clave::Aporte(jugador.clone());
        let anterior: i128 = env.storage().persistent().get(&clave).unwrap_or(0);
        if anterior == 0 {
            if mejenga.jugadores >= mejenga.cupo {
                return Err(Error::CupoLleno);
            }
            mejenga.jugadores += 1;
        }
        env.storage().persistent().set(&clave, &(anterior + monto));
        mejenga.recaudado += monto;
        env.storage().instance().set(&Clave::Mejenga, &mejenga);
        token::Client::new(&env, &mejenga.token).transfer(
            &jugador,
            &env.current_contract_address(),
            &monto,
        );
        Ok(())
    }

    pub fn pagar_cancha(env: Env) -> Result<(), Error> {
        let mut mejenga = Self::estado(env.clone());
        if mejenga.pagado {
            return Err(Error::YaPagado);
        }
        if mejenga.recaudado != mejenga.meta {
            return Err(Error::MetaNoAlcanzada);
        }
        mejenga.pagado = true;
        env.storage().instance().set(&Clave::Mejenga, &mejenga);
        token::Client::new(&env, &mejenga.token).transfer(
            &env.current_contract_address(),
            &mejenga.cancha,
            &mejenga.meta,
        );
        Ok(())
    }

    pub fn reembolsar(env: Env, jugador: Address) -> Result<i128, Error> {
        jugador.require_auth();
        let mut mejenga = Self::estado(env.clone());
        if mejenga.pagado {
            return Err(Error::YaPagado);
        }
        if env.ledger().timestamp() < mejenga.limite {
            return Err(Error::PlazoNoVencido);
        }
        if mejenga.recaudado == mejenga.meta {
            return Err(Error::MetaAlcanzada);
        }
        let clave = Clave::Aporte(jugador.clone());
        let monto: i128 = env.storage().persistent().get(&clave).unwrap_or(0);
        if monto == 0 {
            return Err(Error::SinAporte);
        }
        env.storage().persistent().remove(&clave);
        mejenga.recaudado -= monto;
        mejenga.jugadores -= 1;
        env.storage().instance().set(&Clave::Mejenga, &mejenga);
        token::Client::new(&env, &mejenga.token).transfer(
            &env.current_contract_address(),
            &jugador,
            &monto,
        );
        Ok(monto)
    }

    pub fn estado(env: Env) -> Mejenga {
        env.storage().instance().get(&Clave::Mejenga).unwrap()
    }

    pub fn aporte_de(env: Env, jugador: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&Clave::Aporte(jugador))
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
