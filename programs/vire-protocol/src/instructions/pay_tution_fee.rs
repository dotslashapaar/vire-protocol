use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{transfer_checked, TransferChecked}, token_interface::{Mint, TokenAccount, TokenInterface}};
use mpl_core::{
    ID as MPL_CORE_ID,
    instructions::CreateV2CpiBuilder,
    accounts::BaseCollectionV1,
    types::{
        FreezeDelegate,
        Edition,
        Plugin,
        PluginAuthority,
        PluginAuthorityPair,
    },
};

use crate::states::{StudentAccount, StudentCardAccount, SubjectAccount, UniAccount, VireAccount};
use crate::errors::ErrorCode;
use crate::helpers::*;

#[derive(Accounts)]
pub struct PayTutionFee<'info>{
    #[account(mut)]
    pub student: Signer<'info>,//payer and owner of assest
    pub mint_usdc: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub uni_admin: SystemAccount<'info>,

    //freeze account
    #[account(
        init,
        payer = student,
        seeds = [student_account.key().as_ref(), &[student_account.card_number], subject_account.key().as_ref()],
        bump,
        space = 8 + StudentCardAccount::INIT_SPACE,
    )]
    pub student_card_account: Account<'info, StudentCardAccount>,//asset auth

    //student
    #[account(
        seeds = [
            student.key().as_ref(), 
            subject_account.key().as_ref(), 
            uni_account.key().as_ref(), 
            vire_account.key().as_ref()
            ],
        bump = student_account.student_bump,
    )]
    pub student_account: Account<'info, StudentAccount>,

    #[account(
        mut,
        associated_token::mint = mint_usdc,
        associated_token::authority = student,
    )]
    pub student_ata_usdc: InterfaceAccount<'info, TokenAccount>,

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
    
    #[account(
        mut,
        associated_token::mint = mint_usdc,
        associated_token::authority = uni_admin,
    )]
    pub uni_ata_usdc: InterfaceAccount<'info, TokenAccount>,

    //vire
    #[account(
        seeds = [b"vire", vire_account.admin_key.key().as_ref()],
        bump = vire_account.vire_bump,
    )]
    pub vire_account: Account<'info, VireAccount>,

    #[account(
        mut,
        associated_token::mint = mint_usdc,
        associated_token::authority = vire_account
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    //collection
    #[account(
        mut,
        constraint = collection.update_authority == subject_account.key(),
    )]
    pub collection: Account<'info, BaseCollectionV1>,

    #[account(mut)]
    pub asset: Signer<'info>, //asset will be transformed into a Core Collection Account during this instruction


    #[account(address = MPL_CORE_ID)]
    /// CHECK: This is checked by the address constraint
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> PayTutionFee<'info> {
    pub fn initialize_card(&mut self, bumps: &PayTutionFeeBumps)->Result<()>{
        // Ensure the student's card is not already staked
        require!(!self.student_account.staked_card, ErrorCode::CardAlreadyStaked);

        self.student_card_account.set_inner(StudentCardAccount { 
            owner: self.student.key(), 
            card_mint: self.asset.key(), 
            freeze_at: 0, 
            card_bump: bumps.student_card_account,
        });

        Ok(())
    }

    pub fn pay_tution_fee(&mut self) -> Result<()> {
        // Ensure the student's card is not already staked
        require!(!self.student_account.staked_card, ErrorCode::CardAlreadyStaked);

        let tution_fee = (self.subject_account.tution_fee).checked_div(self.subject_account.max_semester as u32).unwrap();
        let vire_fee = (tution_fee.checked_div(100).unwrap()) * (self.vire_account.transaction_fee_student as u32);
        
        let tution_fee_amount = tution_fee as u64;
        let vire_amount = vire_fee as u64;
    
        // Check if student_ata_usdc has sufficient balance for both transfers
        require!(self.student_ata_usdc.amount >= tution_fee_amount + vire_amount, ErrorCode::InsufficientBalance);
    
        let cpi_program = self.token_program.to_account_info();
        
        // student to treasury
        let cpi_accounts = TransferChecked {
            from: self.student_ata_usdc.to_account_info(),
            to: self.treasury.to_account_info(),
            mint: self.mint_usdc.to_account_info(),
            authority: self.student.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program.clone(), cpi_accounts);
    
        transfer_checked(cpi_ctx, vire_amount, self.mint_usdc.decimals)?;
    
        // student to uni_ata_usdc
        let cpi_accounts = TransferChecked {
            from: self.student_ata_usdc.to_account_info(),
            to: self.uni_ata_usdc.to_account_info(),
            mint: self.mint_usdc.to_account_info(),
            authority: self.student.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program.clone(), cpi_accounts);
    
        transfer_checked(cpi_ctx, tution_fee_amount, self.mint_usdc.decimals)?;
    
        Ok(())
    }

    pub fn mint_card(&mut self, args: CardArgs) -> Result<()> {
        // Ensure the student's card is not already staked
        require!(!self.student_account.staked_card, ErrorCode::CardAlreadyStaked);

        let mut edition_plugin: Vec<PluginAuthorityPair> = vec![];


        edition_plugin.push(PluginAuthorityPair {
            plugin: Plugin::FreezeDelegate(FreezeDelegate { frozen: true }), // Changed to FreezeDelegate
            authority: Some(PluginAuthority::UpdateAuthority), // Authority set to UpdateAuthority
        });

        edition_plugin.push(PluginAuthorityPair {
            plugin: Plugin::Edition(Edition {
                number: 1,
            }),
            authority: None,
        });

        let student_card_seeds: &[&[u8]] = &[
            self.student_account.to_account_info().key.as_ref(),
            &[self.student_account.card_number],
            self.subject_account.to_account_info().key.as_ref(),
            &[self.student_card_account.card_bump],
        ];

        
        let signer = &[&student_card_seeds[..]];

        
        CreateV2CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .authority(Some(&self.student_card_account.to_account_info()))
            .payer(&self.student.to_account_info())
            .owner(Some(&self.student.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .name(args.name)
            .uri(args.uri)
            .plugins(edition_plugin)
            .invoke_signed(signer)?; //update authority is student_card_account so we need invoke with seeds

            self.student_card_account.freeze_at = Clock::get()?.unix_timestamp;
            self.student_account.staked_card = true;
        Ok(())
    }
}