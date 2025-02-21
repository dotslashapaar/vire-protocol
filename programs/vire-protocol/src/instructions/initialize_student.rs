use anchor_lang::prelude::*;

use crate::states::{StudentAccount, SubjectAccount, UniAccount, VireAccount};
use crate::errors::ErrorCode;


#[derive(Accounts)]
pub struct InitializeStudent<'info>{
    #[account(mut)]
    pub student: Signer<'info>,

    #[account(
        init,
        payer = student,
        seeds = [
            student.key().as_ref(), 
            subject_account.key().as_ref(), 
            uni_account.key().as_ref(), 
            vire_account.key().as_ref()
            ],
        bump,
        space = 8 + StudentAccount::INIT_SPACE,
    )]
    pub student_account: Box<Account<'info, StudentAccount>>,

    //subject
    #[account(
        seeds = [uni_account.key().as_ref(), &[subject_account.subject_code], vire_account.key().as_ref()],
        bump = subject_account.subject_bump,
    )]
    pub subject_account: Box<Account<'info, SubjectAccount>>,
    
    //uni
    #[account(
        mut,
        seeds = [b"uni", uni_account.uni_key.key().as_ref(), vire_account.key().as_ref()],
        bump = uni_account.uni_bump,
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

impl <'info> InitializeStudent<'info>{
    pub fn initialize_student(&mut self, bumps: &InitializeStudentBumps) -> Result<()> {
        // Ensure the student_account is not already initialized
        require!(self.student_account.student_key == Pubkey::default(), ErrorCode::AlreadyInitialized);
    
        // Validate card_number
        // require!(card_number > 0 , ErrorCode::InvalidCardNumber);
    
        self.student_account.set_inner(StudentAccount { 
            student_key: self.student.key(), 
            student_id: self.uni_account.student_number, 
            card_number: 0, 
            staked_card: false, 
            student_bump: bumps.student_account,
        });
    
        self.uni_account.student_number += 1;
        
    
        Ok(())
    }
    
}