use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{transfer_checked, TransferChecked}, token_interface::{Mint, TokenAccount, TokenInterface}};

use crate::states::{SubjectAccount, UniAccount, VireAccount};
use crate::errors::ErrorCode;


#[derive(Accounts)]
pub struct EditSubject<'info>{
    #[account(mut)]
    pub uni_admin: Signer<'info>,
    pub mint_usdc: Box<InterfaceAccount<'info, Mint>>,

    //subject
    #[account(
        mut,
        seeds = [uni_account.key().as_ref(), &[subject_account.subject_code], vire_account.key().as_ref()],
        bump = subject_account.subject_bump,
    )]
    pub subject_account: Box<Account<'info, SubjectAccount>>,
    
    //uni
    #[account(
        seeds = [b"uni", uni_admin.key().as_ref(), vire_account.key().as_ref()],
        bump = uni_account.uni_bump,
    )]
    pub uni_account: Box<Account<'info, UniAccount>>,
    
    #[account(
        mut,
        associated_token::mint = mint_usdc,
        associated_token::authority = uni_admin,
    )]
    pub uni_ata_usdc: Box<InterfaceAccount<'info, TokenAccount>>,

    //vire
    #[account(
        seeds = [b"vire", vire_account.admin_key.key().as_ref()],
        bump = vire_account.vire_bump,
    )]
    pub vire_account: Box<Account<'info, VireAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_usdc,
        associated_token::authority = vire_account
    )]
    pub treasury: Box<InterfaceAccount<'info, TokenAccount>>,


    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl <'info>EditSubject<'info> {

    pub fn edit_subject(&mut self, tution_fee: u32, max_semester: u8, semester_months: u8) -> Result<()> {
        // Validate tution_fee
        require!(tution_fee > 0, ErrorCode::InvalidTutionFee);
    
        // Validate max_semester
        require!(max_semester > 0 && max_semester <= 8, ErrorCode::InvalidMaxSemester);
    
        // Validate card_freeze_time
        require!(semester_months > 0, ErrorCode::InvalidCardFreezeTime);
    
        self.subject_account.tution_fee = tution_fee;
        self.subject_account.max_semester = max_semester;
        self.subject_account.semester_months = semester_months;
    
        Ok(())
    }
    
    pub fn uni_vire_fee(&mut self) -> Result<()> {
        let fee = ((self.subject_account.tution_fee).checked_div(100).unwrap()) * (self.vire_account.transaction_fee_uni as u32);
        let fee_amount = fee as u64;
    
        // Check if uni_ata_usdc has sufficient balance
        require!(self.uni_ata_usdc.amount >= fee_amount, ErrorCode::InsufficientBalance);
    
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: self.uni_ata_usdc.to_account_info(),
            to: self.treasury.to_account_info(),
            mint: self.mint_usdc.to_account_info(),
            authority: self.uni_admin.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
        transfer_checked(cpi_ctx, fee_amount, self.mint_usdc.decimals)?;
    
        Ok(())
    }

}