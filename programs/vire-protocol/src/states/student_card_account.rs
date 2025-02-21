use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StudentCardAccount{
    pub owner: Pubkey,
    pub freeze_at: i64,
    pub card_bump: u8,
}

