use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Vault is empty.")]
    InsufficientFunds,
    #[msg("Unauthorized access.")]
    Unauthorized,
    #[msg("Admin account already generated")]
    AdminAlreadyExists,
    #[msg("Insufficient balance in uni_ata_usdc")]
    InsufficientBalance,
    #[msg("Invalid tution fee")]
    InvalidTutionFee,
    #[msg("Invalid max semester value")]
    InvalidMaxSemester,
    #[msg("Invalid card freeze time")]
    InvalidCardFreezeTime,
    #[msg("Invalid transaction fee (must be between 1 and 100)")]
    InvalidTransactionFee,
    #[msg("Vire account is already initialized")]
    AlreadyInitialized,
    #[msg("Invalid card number")]
    InvalidCardNumber,
    #[msg("Card is already staked")]
    CardAlreadyStaked,
    #[msg("Card cannot be un-frozen yet")]
    CardCannotBeUnfrozenYet,
    #[msg("Card is not currently frozen")]
    CardNotFrozen,
}