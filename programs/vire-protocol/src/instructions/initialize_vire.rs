use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{Mint, TokenAccount, TokenInterface}};

use crate::states::VireAccount;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct InitializeVire<'info>{
    #[account(mut)]
    pub admin: Signer<'info>,
    pub mint_usdc: Box<InterfaceAccount<'info, Mint>>,
    
    // vire
    #[account(
        init,
        payer = admin,
        seeds = [b"vire", admin.key().as_ref()],
        bump,
        space = 8 + VireAccount::INIT_SPACE,
    )]
    pub vire_account: Box<Account<'info, VireAccount>>,

    #[account(
        init,
        payer = admin,
        associated_token::mint = mint_usdc,
        associated_token::authority = vire_account
    )]
    pub treasury: Box<InterfaceAccount<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl <'info>InitializeVire<'info> {
    pub fn initialize_vire(&mut self, transaction_fee_uni: u8, transaction_fee_student: u8, bumps: &InitializeVireBumps) -> Result<()> {
        //  If you already know which account you will use then un-comment the below code for safty from unauthised access 
        // Replace "YourAuthorizedAdminPublicKeyHere" with the actual authorized admin public key
        // let expected_admin_key = Pubkey::from_str("YourAuthorizedAdminPublicKeyHere").unwrap();
        // require!(self.admin.key() == expected_admin_key, ErrorCode::Unauthorized);
        
        // Ensure the vire_account is not already initialized
        require!(self.vire_account.admin_key == Pubkey::default(), ErrorCode::AlreadyInitialized);

        
        // Validate transaction_fee_uni (e.g., must be between 1 and 100)
        require!(transaction_fee_uni > 0 && transaction_fee_uni <= 100, ErrorCode::InvalidTransactionFee);
    
        // Validate transaction_fee_student (e.g., must be between 1 and 100)
        require!(transaction_fee_student > 0 && transaction_fee_student <= 100, ErrorCode::InvalidTransactionFee);
    
        self.vire_account.set_inner(VireAccount { 
            admin_key: self.admin.key(), 
            uni_number: 1, 
            transaction_fee_uni,
            transaction_fee_student, 
            vire_bump: bumps.vire_account
        });
    
        Ok(())
    }
}