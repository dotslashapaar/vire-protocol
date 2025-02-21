use anchor_lang::prelude::*;

use crate::states::VireAccount;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct EditVire<'info>{
    #[account(mut)]
    pub admin: Signer<'info>,
    
    // vire
    #[account(
        mut,
        seeds = [b"vire", vire_account.admin_key.key().as_ref()],
        bump = vire_account.vire_bump,
    )]
    pub vire_account: Box<Account<'info, VireAccount>>,

    pub system_program: Program<'info, System>,
}

impl <'info>EditVire<'info> {
    pub fn edit_vire(&mut self, transaction_fee_uni: u8, transaction_fee_student: u8) -> Result<()> {
        // Ensure the caller is the admin
        require!(self.admin.key() == self.vire_account.admin_key, ErrorCode::Unauthorized);

        // Validate transaction_fee_uni (e.g., must be between 1 and 100)
        require!(transaction_fee_uni > 0 && transaction_fee_uni <= 100, ErrorCode::InvalidTransactionFee);
    
        // Validate transaction_fee_student (e.g., must be between 1 and 100)
        require!(transaction_fee_student > 0 && transaction_fee_student <= 100, ErrorCode::InvalidTransactionFee);
    
        self.vire_account.transaction_fee_uni = transaction_fee_uni;
        self.vire_account.transaction_fee_student = transaction_fee_student;
    
        Ok(())
    }
}