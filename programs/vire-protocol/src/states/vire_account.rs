use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VireAccount{
    pub admin_key: Pubkey,
    pub uni_number: u16,
    pub transaction_fee: u8,
    pub treasury_bump: u8,
    pub vire_bump: u8,
}

// space = 8 + 4 + 2 + 1 + 1 + 1