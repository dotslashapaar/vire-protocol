use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StudentCardAccount{
    pub owner: Pubkey,
    pub card_mint: Pubkey,
    pub freeze_at: i64,
    pub card_bump: u8,
}

// space = 8 + 32 + 32 + 8 + 1