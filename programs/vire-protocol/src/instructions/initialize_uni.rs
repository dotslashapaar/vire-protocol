use anchor_lang::prelude::*;

use crate::states::{UniAccount, VireAccount};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct InitializeUni<'info>{
    #[account(mut)]
    pub uni_admin: Signer<'info>,
    
    //uni
    #[account(
        init,
        payer = uni_admin,
        seeds = [b"uni", uni_admin.key().as_ref(), vire_account.key().as_ref()],
        bump,
        space = 8 + UniAccount::INIT_SPACE,
    )]
    pub uni_account: Box<Account<'info, UniAccount>>,
    
    //vire
    #[account(
        seeds = [b"vire", vire_account.admin_key.key().as_ref()],
        bump = vire_account.vire_bump,
    )]
    pub vire_account: Box<Account<'info, VireAccount>>,
    
    pub system_program: Program<'info, System>,
}

impl <'info>InitializeUni<'info> {
    pub fn initialize_uni(&mut self, bumps: &InitializeUniBumps) -> Result<()> {
        // Ensure the uni_account is not already initialized
        require!(self.uni_account.uni_key == Pubkey::default(), ErrorCode::AlreadyInitialized);
    
        // // Ensure the uni_admin is authorized to initialize the uni_account
        // require!(self.uni_admin.key() == self.vire_account.admin_key, ErrorCode::Unauthorized);
    
        self.uni_account.set_inner(UniAccount { 
            uni_key: self.uni_admin.key(), 
            uni_id: self.vire_account.uni_number, 
            subject_number: 0,
            student_number: 0, 
            uni_bump: bumps.uni_account
        });
    
        self.vire_account.uni_number += 1;
    
        Ok(())
    }
    
}