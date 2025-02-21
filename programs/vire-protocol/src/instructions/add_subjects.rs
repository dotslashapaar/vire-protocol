use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{transfer_checked, TransferChecked}, token_interface::{Mint, TokenAccount, TokenInterface}};
use mpl_core::{
    self,
    ID as MPL_CORE_ID,
    instructions::CreateCollectionV2CpiBuilder,
    types::{
        Attribute,
        Attributes,
        Plugin,
        PluginAuthority,
        PluginAuthorityPair,
        MasterEdition,
    },
};

use crate::states::{SubjectAccount, UniAccount, VireAccount};
use crate::errors::ErrorCode;
use crate::helpers::*;

#[derive(Accounts)]
pub struct AddSubject<'info>{
    #[account(mut)]
    pub uni_admin: Signer<'info>,//payer
    pub mint_usdc: Box<InterfaceAccount<'info, Mint>>,

    //subject
    #[account(
        init,
        payer = uni_admin,
        seeds = [uni_account.key().as_ref(), &[uni_account.subject_number], vire_account.key().as_ref()],
        bump,
        space = 8 + SubjectAccount::INIT_SPACE,
    )]
    pub subject_account: Account<'info, SubjectAccount>,//update auth
    
    //uni
    #[account(
        mut,
        seeds = [b"uni", uni_account.uni_key.key().as_ref(), vire_account.key().as_ref()],
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

    //collection
    /// CHECK: This is the collection mint. We'll create this account in the code.
    #[account(mut)]
    pub collection: Signer<'info>,

    #[account(address = MPL_CORE_ID)]
    /// CHECK: this account is checked by the address constraint
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}


impl <'info> AddSubject<'info>{
    pub fn init_subject(&mut self, tution_fee: u32, max_semester: u8, semester_months: u8, bumps: &AddSubjectBumps) -> Result<()> {
        // Validate tution_fee
        require!(tution_fee > 0, ErrorCode::InvalidTutionFee);
    
        // Validate max_semester
        require!(max_semester > 0 && max_semester <= 16, ErrorCode::InvalidMaxSemester);
    
        // Validate card_freeze_time
        require!(semester_months > 0, ErrorCode::InvalidCardFreezeTime);
    
        self.subject_account.set_inner(SubjectAccount { 
            uni_key: self.uni_admin.key(), 
            subject_code: self.uni_account.subject_number, 
            tution_fee, 
            max_semester, 
            semester_months, 
            subject_bump: bumps.subject_account, 
        });
    
        self.uni_account.subject_number += 1;
    
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

    pub fn make_collection(&mut self, args: CreateCardCollectionArgs)->Result<()>{
        require!(self.subject_account.uni_key.eq(&self.uni_admin.key()), ErrorCode::Unauthorized);

        //Lets create a vector to hold our plugins to freeze the assets
        let mut collection_plugins: Vec<PluginAuthorityPair> = vec![];

        let attribute_list: Vec<Attribute> = vec![
            Attribute {
                key: "name".to_string(),
                value: args.name.clone(),
            },
            Attribute {
                key: "uri".to_string(),
                value: args.uri.clone(),
            }
        ];

        //note, we need better implementation besides keeping cloning
        let master_editon = MasterEdition {
            max_supply: None, //---> Better ignore this to have unlimited supply
            name: Some(args.name.clone()),
            uri: Some(args.uri.clone()),
        };

        //Add attributes as additional data
        collection_plugins.push(PluginAuthorityPair {
            plugin: Plugin::Attributes(Attributes { attribute_list }),
            authority: Some(PluginAuthority::UpdateAuthority),
        });

        //add Master Edition to print editions
        collection_plugins.push(PluginAuthorityPair {
            plugin: Plugin::MasterEdition(master_editon),
            authority: Some(PluginAuthority::UpdateAuthority),
        });

        //Create the collection asset
        CreateCollectionV2CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .collection(&self.collection.to_account_info())
            .payer(&self.uni_admin.to_account_info())
            .update_authority(Some(&self.subject_account.as_ref()))
            .system_program(&self.system_program.to_account_info())
            .name(args.name)
            .uri(args.uri)
            .plugins(collection_plugins) //the plugins you wanted to add to the collection - Optional line
            .invoke()?;


        Ok(())
    }
}

