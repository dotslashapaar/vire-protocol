use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{transfer_checked, TransferChecked}, token_interface::{Mint, TokenAccount, TokenInterface}};

use crate::states::VireAccount;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct TreasuryWithdraw<'info>{
    #[account(mut)]
    pub admin: Signer<'info>,
    pub mint_usdc: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = mint_usdc,
        associated_token::authority = admin
    )]
    pub admin_ata_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    
    // vire
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

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl <'info> TreasuryWithdraw<'info>{
    pub fn treasury_withdraw(&mut self)->Result<()>{

        // Check if the treasury has sufficient balance
        require!(self.treasury.amount > 0, ErrorCode::InsufficientBalance);

        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = TransferChecked{
            from: self.treasury.to_account_info(),
            mint: self.mint_usdc.to_account_info(),
            to: self.admin_ata_usdc.to_account_info(),
            authority: self.vire_account.to_account_info(),
        };

        let seeds: &[&[u8]] = &[
            b"vire",
            self.admin.to_account_info().key.as_ref(),
            &[self.vire_account.vire_bump],
        ];
    
        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        transfer_checked(cpi_ctx, self.treasury.amount, self.mint_usdc.decimals)?;


        Ok(())
    }
}