import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { VireProtocol } from "../target/types/vire_protocol";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";
import {
  MPL_CORE_PROGRAM_ID,
  fetchAsset,
  fetchCollection,
  mplCore,
} from '@metaplex-foundation/mpl-core';

const mplCoreProgramId = new PublicKey(MPL_CORE_PROGRAM_ID);

describe("vire-protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.VireProtocol as Program<VireProtocol>;

  const admin = Keypair.generate();
  const uniAdmin = Keypair.generate();
  const student = Keypair.generate();
  const unauthorizedUser = Keypair.generate();

  //mpl-core
  const cardCollection = Keypair.generate();
  const cardCollection2 = Keypair.generate();

  const cardNFT = Keypair.generate();

  let mintUsdc: PublicKey;
  // let vireAccount: PublicKey;
  // let uniAccount: PublicKey;
  // let studentAccount: PublicKey;
  // let subjectAccount: PublicKey;
  // let studentCardAccount: PublicKey;
  let treasury: PublicKey;
  let uniAtaUsdc: PublicKey;
  let studentAtaUsdc: PublicKey;

  const vireAccount =  PublicKey.findProgramAddressSync( [Buffer.from("vire"), admin.publicKey.toBuffer()], program.programId)[0];
  const uniAccount = PublicKey.findProgramAddressSync( [Buffer.from("uni"), uniAdmin.publicKey.toBuffer(), vireAccount.toBuffer()], program.programId)[0];
  const subjectAccount = PublicKey.findProgramAddressSync(
    [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
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
  
  const studentCardAccount = PublicKey.findProgramAddressSync(
    [
      studentAccount.toBuffer(),
      Buffer.from([1]), // card_number = 1
      subjectAccount.toBuffer(),
    ],
    program.programId
  )[0];

  

  before(async () => {
    // Airdrop SOL to accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(admin.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(uniAdmin.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(student.publicKey, 10 * LAMPORTS_PER_SOL)
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

    studentAtaUsdc = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      student,
      mintUsdc,
      student.publicKey
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
      uniAtaUsdc,
      admin,
      1000000000 // 1000 USDC
    );



    treasury = await anchor.utils.token.associatedAddress({
      mint: mintUsdc,
      owner: vireAccount
    });

  });


  // All Vire Protocol Initialize Tests
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


  it("Initializes Uni", async () => {

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

  it("Fails to Initialize Uni with Unauthorized User", async () => {
    
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

  it("Adds Subject", async () => {

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

    const subjectState = await program.account.subjectAccount.fetch(subjectAccount);
    assert.equal(subjectState.tutionFee, 10000);
    assert.equal(subjectState.maxSemester, 8);
    assert.equal(subjectState.semesterMonths, 4);
  });

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


  it("Edits Subject Successfully", async () => {
  
    await program.methods
      .editSubject(15000, 6, 6) // New values: tuition=15000, max_semester=10, semester_months=6
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
    assert.equal(subjectState.maxSemester, 6);
    assert.equal(subjectState.semesterMonths, 6);
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

  it("Initializes Student", async () => {

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

  it("Pays Tuition Fee", async () => {

    await program.methods
      .payTutionFee()
      .accountsPartial({
        student: student.publicKey,
        mintUsdc,
        uniAdmin: uniAdmin.publicKey,
        studentCardAccount: PublicKey.findProgramAddressSync(
          [studentAccount.toBuffer(), Buffer.from([0]), subjectAccount.toBuffer()],
          program.programId
        )[0],
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

    // const studentCardState = await program.account.studentCardAccount.fetch(studentCardAccount);
    // assert.equal(studentCardState.owner.toString(), student.publicKey.toString());
    // assert.equal(studentCardState.owner.toString(), student.publicKey.toString());
    // assert(studentCardState.freezeAt > 0);
  });

  it("Mints Card For Student", async () => {

    await program.methods
      .mintCard({
        name: "Test Card",
        uri: "https://example.com/card"
      })
      .accountsPartial({
        student: student.publicKey,
        studentCardAccount: PublicKey.findProgramAddressSync(
          [studentAccount.toBuffer(), Buffer.from([0]), subjectAccount.toBuffer()],
          program.programId
        )[0],
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
      .rpc();

  
  });

  it("UnFreeze Card For Student", async () => {

    await program.methods
      .unstakeCard()
      .accountsPartial({
        student: student.publicKey,
        studentCardAccount: PublicKey.findProgramAddressSync(
          [studentAccount.toBuffer(), Buffer.from([0]), subjectAccount.toBuffer()],
          program.programId
        )[0],
        studentAccount,
        subjectAccount,
        uniAccount,
        vireAccount,
        asset: cardNFT.publicKey,
        mplCoreProgram: mplCoreProgramId,
        systemProgram: SystemProgram.programId,
      })
      .signers([student])
      .rpc();

  
  });


});
