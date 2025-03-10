import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { VireProtocol } from "../target/types/vire_protocol";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { assert, expect } from 'chai';
import {
  MPL_CORE_PROGRAM_ID,
  fetchAsset,
  fetchCollection,
  mplCore,
} from '@metaplex-foundation/mpl-core';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';

const mplCoreProgramId = new PublicKey(MPL_CORE_PROGRAM_ID);

describe("vire-protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.VireProtocol as Program<VireProtocol>;

  const umi = createUmi(provider.connection).use(mplCore());

  const admin = Keypair.generate();
  const uniAdmin = Keypair.generate();
  const uniAdmin2 = Keypair.generate();
  const student = Keypair.generate();
  const student2 = Keypair.generate();
  const student3 = Keypair.generate();
  const student4 = Keypair.generate();
  const unauthorizedUser = Keypair.generate();

  //mpl-core
  const cardCollection = Keypair.generate();
  const cardCollection2 = Keypair.generate();
  const cardCollection3 = Keypair.generate();
  const cardCollection4 = Keypair.generate();

  const cardNFT = Keypair.generate();
  const cardNFT2 = Keypair.generate();
  const cardNFT3 = Keypair.generate();
  const cardNFT4 = Keypair.generate();

  let mintUsdc: PublicKey;
  let treasury: PublicKey;
  let uniAtaUsdc: PublicKey;
  let uniAtaUsdc2: PublicKey;
  let studentAtaUsdc: PublicKey;
  let studentAtaUsdc2: PublicKey;
  let studentAtaUsdc3: PublicKey;
  let studentAtaUsdc4: PublicKey;
  let adminAtaUsdc: PublicKey;
  let unauthorizedUserAtaUsdc: PublicKey;

  const vireAccount =  PublicKey.findProgramAddressSync( [Buffer.from("vire"), admin.publicKey.toBuffer()], program.programId)[0];
  const uniAccount = PublicKey.findProgramAddressSync( [Buffer.from("uni"), uniAdmin.publicKey.toBuffer(), vireAccount.toBuffer()], program.programId)[0];
  const uniAccount2 = PublicKey.findProgramAddressSync( [Buffer.from("uni"), uniAdmin2.publicKey.toBuffer(), vireAccount.toBuffer()], program.programId)[0];
  const subjectAccount = PublicKey.findProgramAddressSync(
    [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
    program.programId
  )[0];

  const subjectAccount2 = PublicKey.findProgramAddressSync(
    [uniAccount.toBuffer(), Buffer.from([1]), vireAccount.toBuffer()],
    program.programId
  )[0];

  const subjectAccount3 = PublicKey.findProgramAddressSync(
    [uniAccount2.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
    program.programId
  )[0];

  const subjectAccount4 = PublicKey.findProgramAddressSync(
    [uniAccount2.toBuffer(), Buffer.from([1]), vireAccount.toBuffer()],
    program.programId
  )[0];

  const studentAccount = PublicKey.findProgramAddressSync(
    [
      student.publicKey.toBuffer(),
      subjectAccount.toBuffer(),
      uniAccount.toBuffer(),
      vireAccount.toBuffer(),
    ],
    program.programId
  )[0];
  const studentAccount2 = PublicKey.findProgramAddressSync(
    [
      student2.publicKey.toBuffer(),
      subjectAccount.toBuffer(),
      uniAccount.toBuffer(),
      vireAccount.toBuffer(),
    ],
    program.programId
  )[0];

  const studentAccount3 = PublicKey.findProgramAddressSync(
    [
      student3.publicKey.toBuffer(),
      subjectAccount3.toBuffer(),
      uniAccount2.toBuffer(),
      vireAccount.toBuffer(),
    ],
    program.programId
  )[0];
  const studentAccount4 = PublicKey.findProgramAddressSync(
    [
      student4.publicKey.toBuffer(),
      subjectAccount4.toBuffer(),
      uniAccount2.toBuffer(),
      vireAccount.toBuffer(),
    ],
    program.programId
  )[0];
  
  const studentCardAccount = PublicKey.findProgramAddressSync(
    [
      studentAccount.toBuffer(),
      subjectAccount.toBuffer(),
    ],
    program.programId
  )[0];
  const studentCardAccount2 = PublicKey.findProgramAddressSync(
    [
      studentAccount2.toBuffer(),
      subjectAccount.toBuffer(),
    ],
    program.programId
  )[0];

  const studentCardAccount3 = PublicKey.findProgramAddressSync(
    [
      studentAccount3.toBuffer(),
      subjectAccount3.toBuffer(),
    ],
    program.programId
  )[0];
  const studentCardAccount4 = PublicKey.findProgramAddressSync(
    [
      studentAccount4.toBuffer(),
      subjectAccount4.toBuffer(),
    ],
    program.programId
  )[0];
  

  before(async () => {
    // Airdrop SOL to accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(admin.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(uniAdmin.publicKey, 100 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(uniAdmin2.publicKey, 100 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(student.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(student2.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(student3.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(student4.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(unauthorizedUser.publicKey, 10 * LAMPORTS_PER_SOL)
    );


    // Create USDC mint
    mintUsdc = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6
    );

    // Create associated token accounts
    // treasury = (await getOrCreateAssociatedTokenAccount(
    //   provider.connection,
    //   vireAdmin,
    //   mintUsdc,
    //   vireAdmin.publicKey
    // )).address;

    uniAtaUsdc = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      uniAdmin,
      mintUsdc,
      uniAdmin.publicKey
    )).address;

    uniAtaUsdc2 = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      uniAdmin2,
      mintUsdc,
      uniAdmin2.publicKey
    )).address;

    studentAtaUsdc = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      student,
      mintUsdc,
      student.publicKey
    )).address;

    studentAtaUsdc2 = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      student2,
      mintUsdc,
      student2.publicKey
    )).address;

    studentAtaUsdc3 = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      student3,
      mintUsdc,
      student3.publicKey
    )).address;

    studentAtaUsdc4 = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      student4,
      mintUsdc,
      student4.publicKey
    )).address;

    adminAtaUsdc = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      student,
      mintUsdc,
      admin.publicKey
    )).address;

    unauthorizedUserAtaUsdc = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      student,
      mintUsdc,
      unauthorizedUser.publicKey
    )).address;

    // Mint USDC to student's ATA
    await mintTo(
      provider.connection,
      admin,
      mintUsdc,
      studentAtaUsdc,
      admin,
      1000000000 // 1000 USDC
    );

    await mintTo(
      provider.connection,
      admin,
      mintUsdc,
      studentAtaUsdc2,
      admin,
      1000000000 // 1000 USDC
    );

    await mintTo(
      provider.connection,
      admin,
      mintUsdc,
      studentAtaUsdc3,
      admin,
      1000000000 // 1000 USDC
    );

    await mintTo(
      provider.connection,
      admin,
      mintUsdc,
      studentAtaUsdc4,
      admin,
      1000000000 // 1000 USDC
    );

    await mintTo(
      provider.connection,
      admin,
      mintUsdc,
      uniAtaUsdc,
      admin,
      1000000000 // 1000 USDC
    );

    await mintTo(
      provider.connection,
      admin,
      mintUsdc,
      uniAtaUsdc2,
      admin,
      1000000000 // 1000 USDC
    );

    await mintTo(
      provider.connection,
      admin,
      mintUsdc,
      adminAtaUsdc,
      admin,
      1000000000 // 1000 USDC
    );

    await mintTo(
      provider.connection,
      admin,
      mintUsdc,
      unauthorizedUserAtaUsdc,
      admin,
      1000000000 // 1000 USDC
    );


    treasury = await anchor.utils.token.associatedAddress({
      mint: mintUsdc,
      owner: vireAccount
    });

  });


  // All Vire Protocol Initialize Tests

  it("Fails to Initialize Vire With 0% Uni Fee", async () => {

    // Attempt to initialize again
    try {
      await program.methods.initializeVire(0, 1)
      .accountsPartial({
        admin: admin.publicKey,
        mintUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "AlreadyInitialized");
    }

  });

  it("Fails to Initialize Vire With Above 100% Uni Fee", async () => {

    // Attempt to initialize again
    try {
      await program.methods.initializeVire(101, 1)
      .accountsPartial({
        admin: admin.publicKey,
        mintUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "AlreadyInitialized");
    }

  });

  it("Fails to Initialize Vire With 0% Student Fee", async () => {

    // Attempt to initialize again
    try {
      await program.methods.initializeVire(3, 0)
      .accountsPartial({
        admin: admin.publicKey,
        mintUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "AlreadyInitialized");
    }

  });

  it("Fails to Initialize Vire With Above 100% Student Fee", async () => {

    // Attempt to initialize again
    try {
      await program.methods.initializeVire(3, 101)
      .accountsPartial({
        admin: admin.publicKey,
        mintUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "AlreadyInitialized");
    }

  });
  

  it("initialize the vire account", async () => {

    await program.methods.initializeVire(3,1)
    .accountsPartial({
      admin: admin.publicKey,
      mintUsdc,
      vireAccount,
      treasury,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([admin])
    .rpc()

    const vireState = await program.account.vireAccount.fetch(vireAccount);
    assert.equal(vireState.adminKey.toString(), admin.publicKey.toString());
    assert.equal(vireState.transactionFeeUni, 3); // 3% fee
    assert.equal(vireState.transactionFeeStudent, 1); // 1% fee

  });

  it("Fails to Initialize Vire Twice", async () => {

    // Attempt to initialize again
    try {
      await program.methods.initializeVire(3, 1)
      .accountsPartial({
        admin: admin.publicKey,
        mintUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "AlreadyInitialized");
    }

  });

  it("Fails to Initialize Vire with Unauthorized User", async () => {

    try {
      await program.methods
        .initializeVire(5, 2)
        .accountsPartial({
          admin: unauthorizedUser.publicKey,
          mintUsdc,
          vireAccount,
          treasury,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([unauthorizedUser])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "Unauthorized");
    }
  });

  it("Edits Vire Successfully", async () => {

    await program.methods
      .editVire(4, 2) // New fees: 4% uni, 2% student
      .accountsPartial({
        admin: admin.publicKey,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const vireState = await program.account.vireAccount.fetch(vireAccount);
    assert.equal(vireState.transactionFeeUni, 4);
    assert.equal(vireState.transactionFeeStudent, 2);
  });

  it("Fails to Edit Vire with Unauthorized User", async () => {

    try {
      await program.methods
        .editVire(10, 5)
        .accountsPartial({
          admin: unauthorizedUser.publicKey,
          vireAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedUser])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "Unauthorized");
    }
  });


  it("Initializes Uni-1", async () => {

    await program.methods
      .initializeUni()
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([uniAdmin])
      .rpc();

    const uniState = await program.account.uniAccount.fetch(uniAccount);
    assert.equal(uniState.uniKey.toString(), uniAdmin.publicKey.toString());
    assert.equal(uniState.studentNumber, 0);
    assert.equal(uniState.subjectNumber, 0);
  });

  it("Initializes Uni-2", async () => {

    await program.methods
      .initializeUni()
      .accountsPartial({
        uniAdmin: uniAdmin2.publicKey,
        uniAccount: uniAccount2,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([uniAdmin2])
      .rpc();

    // const uniState = await program.account.uniAccount.fetch(uniAccount);
    // assert.equal(uniState.uniKey.toString(), uniAdmin.publicKey.toString());
    // assert.equal(uniState.studentNumber, 0);
    // assert.equal(uniState.subjectNumber, 0);
  });

  it("Fails to Initialize Uni-1 with Unauthorized User", async () => {
    
    try {
      await program.methods
        .initializeUni()
        .accountsPartial({
          uniAdmin: unauthorizedUser.publicKey,
          uniAccount,
          vireAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedUser])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "Unauthorized");
    }
  });

  it("Adds Subject-1 in Uni-1", async () => {

    await program.methods
      .addSubjects(10000, 8, 4, {
        name: "Test Subject",
        uri: "https://example.com"
      }) // tution_fee = 10000, max_semester = 8, semesterMonths = 4
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        collection: cardCollection.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin, cardCollection])
      .rpc();

    const subjectState = await program.account.subjectAccount.fetch(subjectAccount);
    assert.equal(subjectState.tutionFee, 10000);
    assert.equal(subjectState.maxSemester, 8);
    assert.equal(subjectState.semesterMonths, 4);
  });

  it("Adds Subject-2 in Uni-1", async () => {

    await program.methods
      .addSubjects(12000, 5, 3, {
        name: "Test Subject",
        uri: "https://example.com"
      }) // tution_fee = 12000, max_semester = 5, semesterMonths = 6
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount: subjectAccount2,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        collection: cardCollection2.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin, cardCollection2])
      .rpc();

  });


  //--> Trying With Umi
  // it('Adds Subject', async () => {
  //   const createCardCollectionParams = {
  //     name: "Test Subject",
  //     uri: "https://example.com"
  //   };

  //   //Config account
  //   try {
  //     const reviewIx = await program.methods
  //     .addSubjects(10000, 8, 4, {
  //       name: "Test Subject",
  //       uri: "https://example.com"
  //     }) // tution_fee = 10000, max_semester = 8, semesterMonths = 30
  //     .accountsPartial({
  //       uniAdmin: uniAdmin.publicKey,
  //       mintUsdc,
  //       subjectAccount,
  //       uniAccount,
  //       uniAtaUsdc,
  //       vireAccount,
  //       treasury,
  //       collection: cardCollection.publicKey,
  //       mplCoreProgram: mplCoreProgramId,
  //       systemProgram: SystemProgram.programId,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //     })
  //     .instruction();

  //     const blockhashContext = await provider.connection.getLatestBlockhash();

  //     const tx = new anchor.web3.Transaction({
  //       feePayer: uniAdmin.publicKey,
  //       blockhash: blockhashContext.blockhash,
  //       lastValidBlockHeight: blockhashContext.lastValidBlockHeight,
  //     }).add(reviewIx);

  //     // Send the transaction, this should fail
  //     const sig = await anchor.web3.sendAndConfirmTransaction(
  //       provider.connection,
  //       tx,
  //       [admin, cardCollection],
  //       {
  //         skipPreflight: true,
  //         commitment: 'finalized',
  //       }
  //     );
  //   } catch (e) {
  //     console.log(e.message);
  //     console.log(e.logs);
  //     assert.fail('Fails to create the Card NFT Collection');
  //   }

  //   // //Solana SDK and metaplex uses different Publickeys types
  //   // const collectionAsset = await fetchCollection(
  //   //   umi,
  //   //   cardCollection.publicKey.toBase58()
  //   // );

  //   // Perform assertions to verify the asset's properties
  //   // expect(collectionAsset).to.exist;
  //   // assert.equal(collectionAsset.name, 'Test Subject');
  //   // assert.equal(
  //   //   collectionAsset.uri,
  //   //   "https://example.com"
  //   // );
  // });

  it("Fails to Add Duplicate Subject", async () => {

    try {
      await program.methods
      .addSubjects(10000, 8, 4, {
        name: "Test Subject",
        uri: "https://example.com"
      }) // tution_fee = 10000, max_semester = 8, semesterMonths = 30
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        collection: cardCollection.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin, cardCollection])
      .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "SubjectAlreadyExists");
    }
  });

  it("Handles 0 Tuition Fee Value", async () => {
    // First, ensure the subject number is set correctly
    const subjectNumber = 1; // Adjust this based on the current state of your subject accounts

    try {
      await program.methods
      .addSubjects(0, 8, 30, { // Max u32 value
        name: "Max Tuition Subject",
        uri: "https://example.com/max-tuition"
      })
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount: PublicKey.findProgramAddressSync(
          [uniAccount.toBuffer(), Buffer.from([subjectNumber]), vireAccount.toBuffer()],
          program.programId
        )[0],
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        collection: cardCollection.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin, cardCollection])
      .rpc();

    const subjectState = await program.account.subjectAccount.fetch(subjectAccount);
    assert.equal(subjectState.tutionFee, 0);
    assert.fail("Expected transaction to fail")
    } catch (error) {
      assert.isOk(error.message, "Fee Amount Exceded!");
    }
  });

  it("Handles Maximum Semester Value", async () => {
    // First, ensure the subject number is set correctly
    const subjectNumber = 1; // Adjust this based on the current state of your subject accounts

    try {
      await program.methods
      .addSubjects(10000, 255, 4, { // Max u32 value
        name: "Max Tuition Subject",
        uri: "https://example.com/max-tuition"
      })
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount: PublicKey.findProgramAddressSync(
          [uniAccount.toBuffer(), Buffer.from([subjectNumber]), vireAccount.toBuffer()],
          program.programId
        )[0],
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        collection: cardCollection.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin, cardCollection])
      .rpc();

    const subjectState = await program.account.subjectAccount.fetch(subjectAccount);
    assert.equal(subjectState.maxSemester, 255);
    assert.fail("Expected transaction to fail")
    } catch (error) {
      assert.isOk(error.message, "Exceded Maximum Semester Value!");
    }
  });

  it("Handles 0 Semester Value", async () => {
    // First, ensure the subject number is set correctly
    const subjectNumber = 1; // Adjust this based on the current state of your subject accounts

    try {
      await program.methods
      .addSubjects(10000, 0, 4, { 
        name: "Max Tuition Subject",
        uri: "https://example.com/max-tuition"
      })
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount: PublicKey.findProgramAddressSync(
          [uniAccount.toBuffer(), Buffer.from([subjectNumber]), vireAccount.toBuffer()],
          program.programId
        )[0],
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        collection: cardCollection.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin, cardCollection])
      .rpc();

    const subjectState = await program.account.subjectAccount.fetch(subjectAccount);
    assert.equal(subjectState.maxSemester, 0);
    assert.fail("Expected transaction to fail")
    } catch (error) {
      assert.isOk(error.message, "Invalid(0) Semester Value!");
    }
  });

  it("Fails to Add Subject with Negative Tuition Fee", async () => {

    try {
      await program.methods
        .addSubjects(
          -100, // Negative tuition fee
          8,    // maxSemester
          4,   // semesterMonths
          {     // args (createCardCollectionArgs)
            name: "Test Subject",
            uri: "https://example.com/test-subject"
          }
        )
        .accountsPartial({
          uniAdmin: uniAdmin.publicKey,
          mintUsdc,
          subjectAccount: PublicKey.findProgramAddressSync(
            [uniAccount.toBuffer(), Buffer.from([1]), vireAccount.toBuffer()],
            program.programId
          )[0],
          uniAccount,
          uniAtaUsdc,
          vireAccount,
          treasury,
          collection: cardCollection.publicKey,
          mplCoreProgram: mplCoreProgramId,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([uniAdmin, cardCollection])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "InvalidTuitionFee");
    }
  });

  it("Fails to Add Subject with Invalid URI", async () => {

    try {
      await program.methods
        .addSubjects(10000, 8, 30, {
          name: "Invalid URI Subject",
          uri: "invalid-uri" // Invalid URI format
        })
        .accountsPartial({
          uniAdmin: uniAdmin.publicKey,
          mintUsdc,
          subjectAccount: PublicKey.findProgramAddressSync(
            [uniAccount.toBuffer(), Buffer.from([1]), vireAccount.toBuffer()],
            program.programId
          )[0],
          uniAccount,
          uniAtaUsdc,
          vireAccount,
          treasury,
          collection: cardCollection.publicKey,
          mplCoreProgram: mplCoreProgramId,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([uniAdmin, cardCollection])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "InvalidURI");
    }
  });

  it("Fails to Add Subject with Invalid Semester Months", async () => {

    try {
      await program.methods
        .addSubjects(10000, 8, 0, { // Invalid semester months
          name: "Invalid Semester Subject",
          uri: "https://example.com/invalid"
        })
        .accountsPartial({
          uniAdmin: uniAdmin.publicKey,
          mintUsdc,
          subjectAccount: PublicKey.findProgramAddressSync(
            [uniAccount.toBuffer(), Buffer.from([1]), vireAccount.toBuffer()],
            program.programId
          )[0],
          uniAccount,
          uniAtaUsdc,
          vireAccount,
          treasury,
          collection: cardCollection.publicKey,
          mplCoreProgram: mplCoreProgramId,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([uniAdmin, cardCollection])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "InvalidSemesterMonths");
    }
  });

  it("Adds Subject-1 in Uni-2", async () => {

    await program.methods
      .addSubjects(1000, 5, 1, {
        name: "Test Subject",
        uri: "https://example.com"
      }) // tution_fee = 1000, max_semester = 5, semesterMonths = 6
      .accountsPartial({
        uniAdmin: uniAdmin2.publicKey,
        mintUsdc,
        subjectAccount: subjectAccount3,
        uniAccount: uniAccount2,
        uniAtaUsdc: uniAtaUsdc2,
        vireAccount,
        treasury,
        collection: cardCollection3.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin2, cardCollection3])
      .rpc();

  });

  it("Adds Subject-2 in Uni-2", async () => {

    await program.methods
      .addSubjects(11000, 6, 2, {
        name: "Test Subject",
        uri: "https://example.com"
      }) // tution_fee = 11000, max_semester = 5, semesterMonths = 6
      .accountsPartial({
        uniAdmin: uniAdmin2.publicKey,
        mintUsdc,
        subjectAccount: subjectAccount4,
        uniAccount: uniAccount2,
        uniAtaUsdc: uniAtaUsdc2,
        vireAccount,
        treasury,
        collection: cardCollection4.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin2, cardCollection4])
      .rpc();

  });



  it("Edits Subject-1 in Uni-1 Successfully", async () => {
  
    await program.methods
      .editSubject(15000, 3, 6) // New values: tuition=15000, max_semester=10, semester_months=2 semester_months is seconds here in testing 
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin])
      .rpc();
  
    const subjectState = await program.account.subjectAccount.fetch(subjectAccount);
    assert.equal(subjectState.tutionFee, 15000);
    assert.equal(subjectState.maxSemester, 3);
    assert.equal(subjectState.semesterMonths, 6);
  });

  it("Edits Subject-2 in Uni-1 Successfully", async () => {
  
    await program.methods
      .editSubject(17000, 4, 3) // New values: tuition=15000, max_semester=10, semester_months=2 semester_months is seconds here in testing 
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount: subjectAccount2,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin])
      .rpc();
  
    // const subjectState = await program.account.subjectAccount.fetch(subjectAccount);
    // assert.equal(subjectState.tutionFee, 15000);
    // assert.equal(subjectState.maxSemester, 6);
    // assert.equal(subjectState.semesterMonths, 4);
  });

  it("Fails to Edit Subject with Unauthorized User", async () => {

    try {
      await program.methods
        .editSubject(15000, 10, 6)
        .accountsPartial({
          uniAdmin: unauthorizedUser.publicKey,
          mintUsdc,
          subjectAccount,
          uniAccount,
          uniAtaUsdc,
          vireAccount,
          treasury,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([unauthorizedUser])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "Unauthorized");
    }
  });

  it("Edit Handles 0 Tuition Fee Value", async () => {
  
    try {
      await program.methods
      .editSubject(0, 6, 6) // New values: tuition= 0, max_semester=6, semester_months=6
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin])
      .rpc();

    const subjectState = await program.account.subjectAccount.fetch(subjectAccount);
    assert.equal(subjectState.tutionFee, 0);
    assert.fail("Expected transaction to fail")
    } catch (error) {
      assert.isOk(error.message, "Fee Amount Exceded!");
    }
  });

  it("Edit Handles Maximum Semester Value", async () => {
    
    try {
      await program.methods
      .editSubject(1000, 2555, 6) // New values: tuition= 10000, max_semester=2555, semester_months=6
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin])
      .rpc();

    const subjectState = await program.account.subjectAccount.fetch(subjectAccount);
    assert.equal(subjectState.maxSemester, 2555);
    assert.fail("Expected transaction to fail")
    } catch (error) {
      assert.isOk(error.message, "Exceded Maximum Semester Value!");
    }
  });

  it("Edit Handles 0 Semester Value", async () => {
    
    try {
      await program.methods
      .editSubject(1000, 0, 6)
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin])
      .rpc();

    const subjectState = await program.account.subjectAccount.fetch(subjectAccount);
    assert.equal(subjectState.maxSemester, 0);
    assert.fail("Expected transaction to fail")
    } catch (error) {
      assert.isOk(error.message, "Invalid(0) Semester Value!");
    }
  });

  it("Fails to Add Subject with Invalid Semester Months", async () => {
    
    try {
      await program.methods
      .editSubject(10000, 8, 0)
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        mintUsdc,
        subjectAccount,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([uniAdmin])
      .rpc();

    assert.fail("Expected transaction to fail")
    } catch (error) {
      assert.isOk(error.message, "Invalid Semester Months");
    }
  });

  it("Initializes Student-1 in Subject-1 in Uni-1", async () => {

    await program.methods
      .initializeStudent() // card_number = 1
      .accountsPartial({
        student: student.publicKey,
        studentAccount,
        subjectAccount,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([student])
      .rpc();

    const studentState = await program.account.studentAccount.fetch(studentAccount);
    assert.equal(studentState.studentKey.toString(), student.publicKey.toString());
    assert.equal(studentState.stakedCard, false);
  });

  it("Initializes Student-2 in Subject-1 in Uni-1 ", async () => {

    await program.methods
      .initializeStudent() // card_number = 1
      .accountsPartial({
        student: student2.publicKey,
        studentAccount: studentAccount2,
        subjectAccount,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([student2])
      .rpc();

    const studentState = await program.account.studentAccount.fetch(studentAccount);
    assert.equal(studentState.studentKey.toString(), student.publicKey.toString());
    assert.equal(studentState.stakedCard, false);
  });

  

  it("Fails to Initialize Student with Unauthorized User", async () => {

    try {
      await program.methods
      .initializeStudent() // card_number = 1
      .accountsPartial({
        student: unauthorizedUser.publicKey,
        studentAccount,
        subjectAccount,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([unauthorizedUser])
      .rpc();

      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "Unauthorized");
    }
  
  });

  it("Student-1 Pays Tuition Fee(Uni-1)", async () => {

    await program.methods
      .payTutionFee()
      .accountsPartial({
        student: student.publicKey,
        mintUsdc,
        uniAdmin: uniAdmin.publicKey,
        studentCardAccount,
        studentAccount,
        studentAtaUsdc,
        subjectAccount,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([student])
      .rpc();

  });

  it("Mints Card For Student-1(Uni-1)", async () => {
    await program.methods
      .mintCard({
        name: "Test Card",
        uri: "https://example.com/card"
      })
      .accountsPartial({
        student: student.publicKey,
        studentCardAccount,
        studentAccount,
        subjectAccount,
        uniAccount,
        vireAccount,
        collection: cardCollection.publicKey,
        asset: cardNFT.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
      })
      .signers([student, cardNFT])
      .rpc(); // Added skipFlight option here
  });

  it("Student-2 Pays Tuition Fee(Uni-1)", async () => {

    await program.methods
      .payTutionFee()
      .accountsPartial({
        student: student2.publicKey,
        mintUsdc,
        uniAdmin: uniAdmin.publicKey,
        studentCardAccount: studentCardAccount2,
        studentAccount: studentAccount2,
        studentAtaUsdc: studentAtaUsdc2,
        subjectAccount,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([student2])
      .rpc();

  });

  it("Mints Card For Student-2(Uni-1)", async () => {
    await program.methods
      .mintCard({
        name: "Test Card",
        uri: "https://example.com/card"
      })
      .accountsPartial({
        student: student2.publicKey,
        studentCardAccount: studentCardAccount2,
        studentAccount: studentAccount2,
        subjectAccount,
        uniAccount,
        vireAccount,
        collection: cardCollection.publicKey,
        asset: cardNFT2.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
      })
      .signers([student2, cardNFT2])
      .rpc(); // Added skipFlight option here
  });

  it("Initializes Student-1 in Subject-1 in Uni-2", async () => {

    await program.methods
      .initializeStudent() // card_number = 1
      .accountsPartial({
        student: student3.publicKey,
        studentAccount: studentAccount3,
        subjectAccount: subjectAccount3,
        uniAccount: uniAccount2,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([student3])
      .rpc();

    // const studentState = await program.account.studentAccount.fetch(studentAccount);
    // assert.equal(studentState.studentKey.toString(), student.publicKey.toString());
    // assert.equal(studentState.stakedCard, false);
  });

  it("Initializes Student-2 in Subject-2 in Uni-2 ", async () => {

    await program.methods
      .initializeStudent() // card_number = 1
      .accountsPartial({
        student: student4.publicKey,
        studentAccount: studentAccount4,
        subjectAccount: subjectAccount4,
        uniAccount: uniAccount2,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([student4])
      .rpc();

    // const studentState = await program.account.studentAccount.fetch(studentAccount);
    // assert.equal(studentState.studentKey.toString(), student.publicKey.toString());
    // assert.equal(studentState.stakedCard, false);
  });
  it("Student-1 Pays Tuition Fee(Uni-2)", async () => {

    await program.methods
      .payTutionFee()
      .accountsPartial({
        student: student3.publicKey,
        mintUsdc,
        uniAdmin: uniAdmin2.publicKey,
        studentCardAccount: studentCardAccount3,
        studentAccount: studentAccount3,
        studentAtaUsdc: studentAtaUsdc3,
        subjectAccount: subjectAccount3,
        uniAccount: uniAccount2,
        uniAtaUsdc: uniAtaUsdc2,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([student3])
      .rpc();

  });

  it("Mints Card For Student-1(Uni-2)", async () => {
    await program.methods
      .mintCard({
        name: "Test Card",
        uri: "https://example.com/card"
      })
      .accountsPartial({
        student: student3.publicKey,
        studentCardAccount: studentCardAccount3,
        studentAccount: studentAccount3,
        subjectAccount: subjectAccount3,
        uniAccount: uniAccount2,
        vireAccount,
        collection: cardCollection3.publicKey,
        asset: cardNFT3.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
      })
      .signers([student3, cardNFT3])
      .rpc(); // Added skipFlight option here
  });

  it("Student-2 Pays Tuition Fee(Uni-2)", async () => {

    await program.methods
      .payTutionFee()
      .accountsPartial({
        student: student4.publicKey,
        mintUsdc,
        uniAdmin: uniAdmin2.publicKey,
        studentCardAccount: studentCardAccount4,
        studentAccount: studentAccount4,
        studentAtaUsdc: studentAtaUsdc4,
        subjectAccount: subjectAccount4,
        uniAccount: uniAccount2,
        uniAtaUsdc: uniAtaUsdc2,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([student4])
      .rpc();

  });

  it("Mints Card For Student-2(Uni-2)", async () => {
    await program.methods
      .mintCard({
        name: "Test Card",
        uri: "https://example.com/card"
      })
      .accountsPartial({
        student: student4.publicKey,
        studentCardAccount: studentCardAccount4,
        studentAccount: studentAccount4,
        subjectAccount: subjectAccount4,
        uniAccount: uniAccount2,
        vireAccount,
        collection: cardCollection4.publicKey,
        asset: cardNFT4.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
      })
      .signers([student4, cardNFT4])
      .rpc(); // Added skipFlight option here
  });


  it("Vire Admin Withdraws From Treasury", async () => {

    await program.methods
      .treasuryWithdraw()
      .accountsPartial({
        admin: admin.publicKey,
        mintUsdc,
        adminAtaUsdc,
        vireAccount,
        treasury,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

  });

  it("Fails Vire Admin To Withdraws 0 Amount From Treasury", async () => {

    try {
      await program.methods
      .treasuryWithdraw()
      .accountsPartial({
        admin: admin.publicKey,
        mintUsdc,
        adminAtaUsdc,
        vireAccount,
        treasury,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "Treasury is Empty");
    }

  });

  it("Fails Un-Authorized User To Withdraws From Treasury", async () => {

    try {
      await program.methods
      .treasuryWithdraw()
      .accountsPartial({
        admin: unauthorizedUser.publicKey,
        mintUsdc,
        adminAtaUsdc,
        vireAccount,
        treasury,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([unauthorizedUser])
      .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "Unauthorized");
    }

  });

 

  it("Fails to UnFreeze Card before Semester Ends(Student-1)", async () => {

    
    try {
      await program.methods
      .unfreezeCard()
      .accountsPartial({
        student: student.publicKey,
        studentCardAccount,
        studentAccount,
        subjectAccount,
        uniAccount,
        vireAccount,
        asset: cardNFT.publicKey,
        collection: cardCollection.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
      })
      .signers([student])
      .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "Semester is not over!");
    }
    

  
  });

  it("Fails to Pays Tuition Fee before UnFreezing Card(Student-1)", async () => {

    try {
      await program.methods
      .payTutionFee()
      .accountsPartial({
        student: student.publicKey,
        mintUsdc,
        uniAdmin: uniAdmin.publicKey,
        studentCardAccount,
        studentAccount,
        studentAtaUsdc,
        subjectAccount,
        uniAccount,
        uniAtaUsdc,
        vireAccount,
        treasury,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([student])
      .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.isOk(error.message, "Cant UnFreeze your Card!");
    }

  });

  it("UnFreeze Card For Student(Student-1)(Uni-1)", async () => {

    // Time for this collection is 6 seconds in testing and 2 months for mainnet
    // so sleep for 6 seconds
    await sleep(7000);

    await program.methods
      .unfreezeCard()
      .accountsPartial({
        student: student.publicKey,
        studentCardAccount,
        studentAccount,
        subjectAccount,
        uniAccount,
        vireAccount,
        asset: cardNFT.publicKey,
        collection: cardCollection.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
      })
      .signers([student])
      .rpc();

  
  });

  it("UnFreeze Card For Student(Student-2)(Uni-1)", async () => {

    // Time for this collection is 3 seconds in testing and 2 months for mainnet
    // so sleep for 4 seconds
    await sleep(4000);

    await program.methods
      .unfreezeCard()
      .accountsPartial({
        student: student2.publicKey,
        studentCardAccount: studentCardAccount2,
        studentAccount: studentAccount2,
        subjectAccount,
        uniAccount,
        vireAccount,
        asset: cardNFT2.publicKey,
        collection: cardCollection.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
      })
      .signers([student2])
      .rpc();

  
  });

  it("UnFreeze Card For Student(Student-1)(Uni-2)", async () => {

    // Time for this collection is 1 seconds in testing and 2 months for mainnet
    // so sleep for 2 seconds
    await sleep(2000);

    await program.methods
      .unfreezeCard()
      .accountsPartial({
        student: student3.publicKey,
        studentCardAccount: studentCardAccount3,
        studentAccount: studentAccount3,
        subjectAccount: subjectAccount3,
        uniAccount: uniAccount2,
        vireAccount,
        asset: cardNFT3.publicKey,
        collection: cardCollection3.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
      })
      .signers([student3])
      .rpc();

  
  });

  it("UnFreeze Card For Student(Student-2)(Uni-2)", async () => {

    // Time for this collection is 2 seconds in testing and 2 months for mainnet
    // so sleep for 3 seconds
    await sleep(3000);

    await program.methods
      .unfreezeCard()
      .accountsPartial({
        student: student4.publicKey,
        studentCardAccount: studentCardAccount4,
        studentAccount: studentAccount4,
        subjectAccount: subjectAccount4,
        uniAccount: uniAccount2,
        vireAccount,
        asset: cardNFT4.publicKey,
        collection: cardCollection4.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
      })
      .signers([student4])
      .rpc();

  
  });


});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
