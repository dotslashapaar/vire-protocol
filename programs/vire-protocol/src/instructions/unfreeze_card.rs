use anchor_lang::prelude::*;
use mpl_core::{
    accounts::{BaseAssetV1, BaseCollectionV1}, instructions::UpdatePluginV1CpiBuilder, types::{FreezeDelegate, Plugin}, ID as MPL_CORE_ID
};

use crate::states::{StudentAccount, StudentCardAccount, SubjectAccount, UniAccount, VireAccount};
use crate::errors::ErrorCode;

// --->Un-Comment the below line when you want smester_months time in months
// const SECONDS_IN_A_MONTH: i64 = 30 * 24 * 60 * 60; // 30 days in seconds

#[derive(Accounts)]
pub struct UnfreezeCard<'info> {

    #[account(mut)]
    pub student: Signer<'info>,//payer and owner of assest

    // // Student account associated with this card, including necessary metadata.
    #[account(
        mut,
        // seeds = [student_account.key().as_ref(), &[student_account.card_number], subject_account.key().as_ref()],
        seeds = [student_account.key().as_ref(), subject_account.key().as_ref()],
        bump = student_card_account.card_bump,
    )]
    pub student_card_account: Box<Account<'info, StudentCardAccount>>, // asset auth

    // Student account
    #[account(
        mut,
        seeds = [
            student_account.student_key.key().as_ref(), 
            subject_account.key().as_ref(), 
            uni_account.key().as_ref(), 
            vire_account.key().as_ref()
        ],
        bump = student_account.student_bump,
    )]
    pub student_account: Box<Account<'info, StudentAccount>>,

    // Subject account
    #[account(
        seeds = [uni_account.key().as_ref(), subject_account.subject_code.to_le_bytes().as_ref(), vire_account.key().as_ref()],
        bump = subject_account.subject_bump,
    )]
    pub subject_account: Box<Account<'info, SubjectAccount>>, // update auth
    
    // University account
    #[account(
        seeds = [b"uni", uni_account.uni_key.key().as_ref(), vire_account.key().as_ref()],
        bump = uni_account.uni_bump,
    )]
    pub uni_account: Box<Account<'info, UniAccount>>,
    
    // Vire account
    #[account(
        seeds = [b"vire", vire_account.admin_key.key().as_ref()],
        bump = vire_account.vire_bump,
    )]
    pub vire_account: Box<Account<'info, VireAccount>>,

    // The Asset account that represents the NFT to be unfrozen.
    #[account(mut)]
    pub asset: Box<Account<'info, BaseAssetV1>>, // Use AssetV1 if available

    //collection
    #[account(
        mut,
        constraint = collection.update_authority == subject_account.key(),
    )]
    pub collection: Box<Account<'info, BaseCollectionV1>>,

    /// CHECK: Safe because we are using it as a cpi
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> UnfreezeCard<'info> {
    pub fn unfreeze_card(&mut self) -> Result<()> {
        // Ensure the card is currently frozen
        require!(self.student_card_account.freeze_at > 0, ErrorCode::CardNotFrozen);
    
        // Check if enough time has passed since the card was frozen.
        let current_timestamp = Clock::get()?.unix_timestamp;
        
        // --->Un-Comment the below line when you want time in months
        // Required wait time set to 1 month (in seconds)
        // let required_wait_time: i64 = SECONDS_IN_A_MONTH * (self.subject_account.semester_months as i64); 

        // --> for reqired time in secs here "self.subject_account.semester_months" is not months but is seconds
        let required_wait_time: i64 = self.subject_account.semester_months as i64;
    
        if current_timestamp - self.student_card_account.freeze_at < required_wait_time {
            return Err(error!(ErrorCode::CardCannotBeUnfrozenYet));
        }
    
        // let student_card_seeds: &[&[u8]] = &[
        //     self.student_account.to_account_info().key.as_ref(),
        //     &[self.student_account.card_number],
        //     self.subject_account.to_account_info().key.as_ref(),
        //     &[self.student_card_account.card_bump],
        // ];

        
        // let signer_seeds = &[&student_card_seeds[..]];

        let subject_account_seeds = &[
            self.uni_account.to_account_info().key.as_ref(), 
            &self.subject_account.subject_code.to_le_bytes()[..], 
            self.vire_account.to_account_info().key.as_ref(),
            &[self.subject_account.subject_bump]
        ];

        let signer_seeds = &[&subject_account_seeds[..]];
    
        UpdatePluginV1CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info())) // Pass Pubkey directly
            .payer(&self.student.to_account_info())
            .authority(Some(&self.subject_account.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: false }))
            .invoke_signed(signer_seeds)?;
    
        // Reset the freeze timestamp
        self.student_card_account.freeze_at = 0;
        self.student_account.staked_card = false;
        Ok(())
    }
}
