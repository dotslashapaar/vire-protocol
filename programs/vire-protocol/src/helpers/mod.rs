use anchor_lang::prelude::*;
use crate::errors::ErrorCode;


// helper for collection
#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct CreateCardCollectionArgs {
    pub name: String,
    pub uri: String,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct CardArgs {
    pub name: String,
    pub uri: String,
}