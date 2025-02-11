use anchor_lang::prelude::*;

use crate::states::VireAccount;


#[derive(Accounts)]
pub struct InitializeVire<'info>{
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        seeds = [b"vire", admin.key().as_ref()],
        bump,
        space = 8 + VireAccount::INIT_SPACE,
    )]
    pub vire_account: Account<'info, VireAccount>,

    #[account(
        seeds = [b"treasury", vire_account.key().as_ref()],
        bump,
    )]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl <'info>InitializeVire<'info> {
    pub fn initialize_vire(&mut self, transaction_fee: u8, bumps: &InitializeVireBumps)-> Result<()>{
        self.vire_account.set_inner(VireAccount { 
            admin_key: self.admin.key(),
            uni_number: 0, 
            transaction_fee, 
            treasury_bump: bumps.treasury, 
            vire_bump: bumps.vire_account, 
        });


        Ok(())
    }
}