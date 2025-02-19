use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VireAccount{
    pub admin_key: Pubkey,
    pub uni_number: u16,
    pub transaction_fee_uni: u8,
    pub transaction_fee_student: u8,
    pub vire_bump: u8,
}

