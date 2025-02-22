use anchor_lang::prelude::*;
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
pub struct MintCard<'info>{
    #[account(mut)]
    pub student: Signer<'info>,//payer and owner of assest

    //freeze account
    #[account(
        mut,
        seeds = [student_account.key().as_ref(), &[student_account.card_number], subject_account.key().as_ref()],
        // seeds = [student_account.key().as_ref(), &[student_account.card_number]],
        bump = student_card_account.card_bump,
    )]
    pub student_card_account: Box<Account<'info, StudentCardAccount>>,//asset auth

    //student
    #[account(
        mut,
        seeds = [
            student.key().as_ref(), 
            subject_account.key().as_ref(), 
            uni_account.key().as_ref(), 
            vire_account.key().as_ref()
            ],
        bump = student_account.student_bump,
    )]
    pub student_account: Box<Account<'info, StudentAccount>>,


    //subject
    #[account(
        seeds = [uni_account.key().as_ref(), &[subject_account.subject_code], vire_account.key().as_ref()],
        bump = subject_account.subject_bump,
    )]
    pub subject_account: Box<Account<'info, SubjectAccount>>,//update auth
    
    //uni
    #[account(
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


    //collection
    #[account(
        mut,
        constraint = collection.update_authority == subject_account.key(),
    )]
    pub collection: Box<Account<'info, BaseCollectionV1>>,

    #[account(mut)]
    pub asset: Signer<'info>, //asset will be transformed into a Core Collection Account during this instruction


    #[account(address = MPL_CORE_ID)]
    /// CHECK: This is checked by the address constraint
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl <'info>MintCard<'info> {
    pub fn mint_card(&mut self, args: CardArgs) -> Result<()> {
        // Ensure the student's card is not already staked
        require!(!self.student_account.staked_card, ErrorCode::CardAlreadyStaked);

        require!( self.student_account.card_number < self.subject_account.max_semester , ErrorCode::InvalidCardNumber);

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
            self.student_account.card_number += 1;
        Ok(())
    }
}