use anchor_lang::prelude::*;

mod states;
mod instructions;

use states::*;
use instructions::*;

declare_id!("9vA67c1uKekSxp9EyUHd5yLwXjPk2VyoGCshxXcHbvxF");

#[program]
pub mod vire_protocol {
    use super::*;

    pub fn initialize_vire(ctx: Context<InitializeVire>, transaction_fee: u8) -> Result<()> {
        ctx.accounts.initialize_vire(transaction_fee, &ctx.bumps)?;
        Ok(())
    }

    // pub fn initialize_uni(ctx: Context<InitializeUni>) -> Result<()> {
    //     msg!("Greetings from: {:?}", ctx.program_id);
    //     Ok(())
    // }

    // pub fn initialize_student(ctx: Context<InitializeStudent>) -> Result<()> {
    //     msg!("Greetings from: {:?}", ctx.program_id);
    //     Ok(())
    // }

    // pub fn pay_tution_fee(ctx: Context<PayTutionFee>) -> Result<()> {
    //     msg!("Greetings from: {:?}", ctx.program_id);
    //     Ok(())
    // }

    // pub fn unstake_card(ctx: Context<UnstakeCard>) -> Result<()> {
    //     msg!("Greetings from: {:?}", ctx.program_id);
    //     Ok(())
    // }
}


