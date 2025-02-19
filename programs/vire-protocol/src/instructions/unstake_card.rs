use anchor_lang::prelude::*;
use mpl_core::{
    ID as MPL_CORE_ID,
    instructions::ThawCpiBuilder,
    accounts::Asset,
};

use crate::states::{StudentAccount, StudentCardAccount, SubjectAccount, UniAccount, VireAccount};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use anchor_spl::associated_token::AssociatedToken;

const SECONDS_IN_A_MONTH: i64 = 30 * 24 * 60 * 60; // 30 days in seconds

#[derive(Accounts)]
pub struct UnfreezeCard<'info> {


    // Student account associated with this card, including necessary metadata.
    #[account(
        mut,
        seeds = [student_account.key().as_ref(), &[student_account.card_number], subject_account.key().as_ref()],
        bump = student_card_account.card_bump,
    )]
    pub student_card_account: Account<'info, StudentCardAccount>,//asset auth

    //student
    #[account(
        seeds = [
            student_account.student_key.key().as_ref(), 
            subject_account.key().as_ref(), 
            uni_account.key().as_ref(), 
            vire_account.key().as_ref()
            ],
        bump = student_account.student_bump,
    )]
    pub student_account: Account<'info, StudentAccount>,


    //subject
    #[account(
        seeds = [uni_account.key().as_ref(), &[uni_account.subject_number], vire_account.key().as_ref()],
        bump = subject_account.subject_bump,
    )]
    pub subject_account: Account<'info, SubjectAccount>,//update auth
    
    //uni
    #[account(
        seeds = [b"uni", uni_account.uni_key.key().as_ref(), vire_account.key().as_ref()],
        bump = uni_account.uni_bump,
    )]
    pub uni_account: Account<'info, UniAccount>,
    

    //vire
    #[account(
        seeds = [b"vire", vire_account.admin_key.key().as_ref()],
        bump = vire_account.vire_bump,
    )]
    pub vire_account: Account<'info, VireAccount>,

    

    // The Asset account that represents the NFT to be unfrozen.
    #[account(mut)]
    pub asset: Account<'info, Asset>,

    // /// CHECK: Safe because we are using it as a cpi
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> UnfreezeCard<'info> {
    pub fn process(&mut self) -> Result<()> {
        // Check if enough time has passed since the card was frozen.
        let current_timestamp = Clock::get()?.unix_timestamp;
        
        // Required wait time set to 1 month (in seconds)
        let required_wait_time: i64 = SECONDS_IN_A_MONTH; 

        if current_timestamp - self.student_card_account.freeze_at < required_wait_time {
            return Err(error!(crate::errors::ErrorCode::CardCannotBeUnfrozenYet));
        }

        // CPI to thaw the asset
        ThawCpiBuilder::new(&self.mpl_core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .authority(&self.authority.to_account_info())
            .invoke()?;

        // Optionally, reset the freeze timestamp if needed
        self.student_card_account.freeze_at = 0;

        Ok(())
    }
}
