use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UniAccount{
    pub uni_key: Pubkey,
    pub uni_id: u16,
    pub subject_number: u8,
    pub student_number: u32,
    pub uni_bump: u8,
}

