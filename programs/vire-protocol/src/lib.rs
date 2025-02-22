use anchor_lang::prelude::*;

pub mod states;
pub mod instructions;
pub mod errors;
pub mod helpers;

use states::*;
use instructions::*;
use helpers::*;

declare_id!("9vA67c1uKekSxp9EyUHd5yLwXjPk2VyoGCshxXcHbvxF");

#[program]
pub mod vire_protocol {
    use super::*;

    pub fn initialize_vire(ctx: Context<InitializeVire>, transaction_fee_uni: u8, transaction_fee_student: u8) -> Result<()> {
        ctx.accounts.initialize_vire(transaction_fee_uni, transaction_fee_student, &ctx.bumps)?;
        Ok(())
    }

    pub fn edit_vire(ctx: Context<EditVire>, transaction_fee_uni: u8, transaction_fee_student: u8) -> Result<()> {
        ctx.accounts.edit_vire(transaction_fee_uni, transaction_fee_student)?;
        Ok(())
    }

    pub fn treasury_withdraw(ctx: Context<TreasuryWithdraw>) -> Result<()> {
        ctx.accounts.treasury_withdraw()?;
        Ok(())
    }

    pub fn initialize_uni(ctx: Context<InitializeUni>) -> Result<()> {
        ctx.accounts.initialize_uni(&ctx.bumps)?;
        Ok(())
    }

    pub fn add_subjects(ctx: Context<AddSubject>, tution_fee: u32, max_semester: u8, semester_months: u8, args: CreateCardCollectionArgs) -> Result<()> {
        ctx.accounts.init_subject(tution_fee, max_semester, semester_months, &ctx.bumps)?;
        ctx.accounts.uni_vire_fee()?;
        ctx.accounts.make_collection(args)?;
        Ok(())
    }

    pub fn edit_subject(ctx: Context<EditSubject>, tution_fee: u32, max_semester: u8, semester_months: u8) -> Result<()> {
        ctx.accounts.edit_subject(tution_fee, max_semester, semester_months)?;
        ctx.accounts.uni_vire_fee()?;
        Ok(())
    }

    pub fn initialize_student(ctx: Context<InitializeStudent>) -> Result<()> {
        ctx.accounts.initialize_student(&ctx.bumps)?;
        Ok(())
    }    

    pub fn pay_tution_fee(ctx: Context<PayTutionFee>) -> Result<()> {
        ctx.accounts.initialize_card(&ctx.bumps)?;
        ctx.accounts.pay_tution_fee()?;
        // ctx.accounts.mint_card(args)?;
        Ok(())
    }

    pub fn mint_card(ctx: Context<MintCard>, args: CardArgs) -> Result<()> {
        ctx.accounts.mint_card(args)?;
        Ok(())
    }

    pub fn unstake_card(ctx: Context<UnfreezeCard>) -> Result<()> {
       ctx.accounts.unfreeze_card()?;
       Ok(())
    }

    
}


