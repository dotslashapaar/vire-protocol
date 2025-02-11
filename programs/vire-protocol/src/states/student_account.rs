use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StudentAccount{
    pub student_key: Pubkey,
    pub student_id: u32,
    pub card_number: u8,
    pub staked_card: bool,
    pub student_bump: u8,
}

// space = 8 + 4 + 4 + 1 + 1 + 1