use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};
use anchor_spl::{
    associated_token::AssociatedToken, 
    metadata::Metadata, 
    token::{
        mint_to, 
        Mint, 
        MintTo, 
        Token, 
        TokenAccount,
    }
};
use anchor_spl::metadata::mpl_token_metadata::{
    instructions::{
        CreateMasterEditionV3Cpi, 
        CreateMasterEditionV3CpiAccounts, 
        CreateMasterEditionV3InstructionArgs, 
        CreateMetadataAccountV3Cpi, 
        CreateMetadataAccountV3CpiAccounts, 
        CreateMetadataAccountV3InstructionArgs
    }, 
    types::{
        CollectionDetails, 
        Creator, 
        DataV2
    }
};

use crate::states::{UniAccount, VireAccount};


#[derive(Accounts)]
pub struct InitializeUni<'info>{
    #[account(mut)]
    pub uni_admin: Signer<'info>,
    pub usd_mint: Account<'info, Mint>,
    
    //uni
    #[account(
        init,
        payer = uni_admin,
        seeds = [b"uni", uni_admin.key().as_ref(), vire_account.key().as_ref()],
        bump,
        space = 8 + UniAccount::INIT_SPACE,
    )]
    pub uni_account: Account<'info, UniAccount>,
    #[account(
        init_if_needed,
        payer = uni_admin,
        associated_token::mint = usd_mint,
        associated_token::authority = uni_admin,
    )]
    pub uni_usd_ata: Account<'info, TokenAccount>,
    
    //vire
    #[account(
        seeds = [b"vire", vire_account.admin_key.key().as_ref()],
        bump = vire_account.vire_bump,
    )]
    pub vire_account: Account<'info, VireAccount>,
    #[account(
        mut,
        seeds = [b"treasury", vire_account.key().as_ref()],
        bump = vire_account.treasury_bump,
    )]
    pub treasury: SystemAccount<'info>,

    //collection
    #[account(
        init,
        payer = uni_admin,
        mint::decimals = 0,
        mint::authority = mint_authority,
        mint::freeze_authority = mint_authority,
    )]
    pub collection_mint: Account<'info, Mint>,

    #[account(
        seeds = [b"authority"],
        bump,
    )]
    /// CHECK: This account is not initialized and is being used for signing purposes only
    pub mint_authority: UncheckedAccount<'info>,

    /// CHECK: This account will be initialized by the metaplex program
    metadata: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: This account will be initialized by the metaplex program
    master_edition: UncheckedAccount<'info>,

    #[account(
        init,
        payer = uni_admin,
        associated_token::mint = collection_mint,
        associated_token::authority = uni_admin,
    )]
    pub uni_col_ata: Account<'info, TokenAccount>,
    
    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    token_metadata_program: Program<'info, Metadata>,
}

impl <'info>InitializeUni<'info> {
    pub fn initialize_uni(&mut self, tution_fee: u32, max_semester: u8, card_freeze_time: u64, bumps: &InitializeUniBumps)->Result<()>{
        self.uni_account.set_inner(UniAccount { 
            uni_key: self.uni_admin.key(), 
            uni_id: self.vire_account.uni_number + 1, 
            student_number: 0, 
            tution_fee, 
            max_semester, 
            collection_mint: self.collection_mint.key(), 
            card_freeze_time, 
            uni_bump: bumps.uni_account
        });

        self.vire_account.uni_number += 1;

        Ok(())
    }

    pub fn send_vire_fee(&mut self)->Result<()>{
        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = Transfer{
            from: self.uni_admin.to_account_info(),
            to: self.treasury.to_account_info()
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, self.vire_account.transaction_fee as u64)?;

        Ok(())
    }

    pub fn create_collection(&mut self, bumps: &InitializeUniBumps)->Result<()>{

        let metadata = &self.metadata.to_account_info();
        let master_edition = &self.master_edition.to_account_info();
        let mint = &self.collection_mint.to_account_info();
        let authority = &self.mint_authority.to_account_info();
        let payer = &self.uni_admin.to_account_info();
        let system_program = &self.system_program.to_account_info();
        let spl_token_program = &self.token_program.to_account_info();
        let spl_metadata_program = &self.token_metadata_program.to_account_info();

        let seeds = &[
            &b"authority"[..], 
            &[bumps.mint_authority]
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = MintTo {
            mint: self.collection_mint.to_account_info(),
            to: self.uni_col_ata.to_account_info(),
            authority: self.mint_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        mint_to(cpi_ctx, 1)?;
        msg!("Collection NFT minted!");

        let creator = vec![
            Creator {
                address: self.mint_authority.key().clone(),
                verified: true,
                share: 100,
            },
        ];


        Ok(())
    }
}