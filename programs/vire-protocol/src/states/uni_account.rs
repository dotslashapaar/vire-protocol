use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UniAccount{
    pub uni_key: Pubkey,
    pub uni_id: u16,
    pub student_number: u32,
    pub tution_fee: u32,
    pub max_semester: u8,
    pub collection_mint: Pubkey,
    pub card_freeze_time: u64,
    pub uni_bump: u8,
}

// space = 8 + 32 + 2 + 4 + 4 + 1 + 32 + 8 + 1