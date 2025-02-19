use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SubjectAccount{
    pub uni_key: Pubkey,
    pub subject_code: u8,
    pub tution_fee: u32,
    pub max_semester: u8,
    pub semester_months: u8,
    pub subject_bump: u8,
}

