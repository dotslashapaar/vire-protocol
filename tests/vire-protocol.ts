// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import { VireProtocol } from "../target/types/vire_protocol";

// describe("vire-protocol", () => {
//   // Configure the client to use the local cluster.
//   anchor.setProvider(anchor.AnchorProvider.env());

//   const program = anchor.workspace.VireProtocol as Program<VireProtocol>;

//   it("Is initialized!", async () => {
//     // Add your test here.
//     const tx = await program.methods.initialize().rpc();
//     console.log("Your transaction signature", tx);
//   });
// });

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { VireProtocol } from "../target/types/vire_protocol";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

describe("vire-protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.VireProtocol as Program<VireProtocol>;

  const vireAdmin = Keypair.generate();
  const uniAdmin = Keypair.generate();
  const student = Keypair.generate();
  const unauthorizedUser = Keypair.generate();
  let mintUsdc: PublicKey;
  let vireAccount: PublicKey;
  let uniAccount: PublicKey;
  let studentAccount: PublicKey;
  let subjectAccount: PublicKey;
  let studentCardAccount: PublicKey;
  let treasury: PublicKey;
  let uniAtaUsdc: PublicKey;
  let studentAtaUsdc: PublicKey;

  before(async () => {
    // Airdrop SOL to accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(vireAdmin.publicKey, 1000000000)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(uniAdmin.publicKey, 1000000000)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(student.publicKey, 1000000000)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(unauthorizedUser.publicKey, 1000000000)
    );

    // Create USDC mint
    mintUsdc = await createMint(
      provider.connection,
      vireAdmin,
      vireAdmin.publicKey,
      null,
      6
    );

    // Create associated token accounts
    treasury = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      vireAdmin,
      mintUsdc,
      vireAdmin.publicKey
    )).address;

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
      vireAdmin,
      mintUsdc,
      studentAtaUsdc,
      vireAdmin,
      1000000000 // 1000 USDC
    );
  });


  it("Initializes Vire", async () => {
    const [virePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vire"), vireAdmin.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeVire(5, 2) // transactionFeeUni: 5%, transactionFeeStudent: 2%
      .accountsPartial({
        admin: vireAdmin.publicKey,
        vireAccount: virePda,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .signers([vireAdmin])
      .rpc();

    const vireState = await program.account.vireAccount.fetch(virePda);
    assert.equal(vireState.adminKey.toString(), vireAdmin.publicKey.toString());
    assert.equal(vireState.transactionFeeUni, 5); // 5% fee
    assert.equal(vireState.transactionFeeStudent, 2); // 2% fee
  });

  it("Fails to Initialize Vire with Unauthorized User", async () => {
    const [virePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vire"), unauthorizedUser.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .initializeVire(5, 2)
        .accountsPartial({
          admin: unauthorizedUser.publicKey,
          vireAccount: virePda,
          treasury,
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedUser])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "Unauthorized");
    }
  });

  it("Initializes Uni", async () => {
    const [uniPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("uni"), uniAdmin.publicKey.toBuffer(), vireAccount.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeUni()
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        uniAccount: uniPda,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([uniAdmin])
      .rpc();

    const uniState = await program.account.uniAccount.fetch(uniPda);
    assert.equal(uniState.uniKey.toString(), uniAdmin.publicKey.toString());
    assert.equal(uniState.studentNumber, 0);
    assert.equal(uniState.subjectNumber, 0);
  });

  it("Fails to Initialize Uni with Unauthorized User", async () => {
    const [uniPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("uni"), unauthorizedUser.publicKey.toBuffer(), vireAccount.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .initializeUni()
        .accountsPartial({
          uniAdmin: unauthorizedUser.publicKey,
          uniAccount: uniPda,
          vireAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedUser])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "Unauthorized");
    }
  });

  it("Initializes Student", async () => {
    const [studentPda] = PublicKey.findProgramAddressSync(
      [
        student.publicKey.toBuffer(),
        subjectAccount.toBuffer(),
        uniAccount.toBuffer(),
        vireAccount.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .initializeStudent(1) // card_number = 1
      .accountsPartial({
        student: student.publicKey,
        studentAccount: studentPda,
        subjectAccount,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([student])
      .rpc();

    const studentState = await program.account.studentAccount.fetch(studentPda);
    assert.equal(studentState.studentKey.toString(), student.publicKey.toString());
    assert.equal(studentState.cardNumber, 1);
    assert.equal(studentState.stakedCard, false);
  });

  it("Fails to Initialize Student with Invalid Card Number", async () => {
    const [studentPda] = PublicKey.findProgramAddressSync(
      [
        student.publicKey.toBuffer(),
        subjectAccount.toBuffer(),
        uniAccount.toBuffer(),
        vireAccount.toBuffer(),
      ],
      program.programId
    );

    try {
      await program.methods
        .initializeStudent(0) // Invalid card_number = 0
        .accountsPartial({
          student: student.publicKey,
          studentAccount: studentPda,
          subjectAccount,
          uniAccount,
          vireAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([student])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "InvalidCardNumber");
    }
  });

  it("Handles Maximum Card Number", async () => {
    const [studentPda] = PublicKey.findProgramAddressSync(
      [
        student.publicKey.toBuffer(),
        subjectAccount.toBuffer(),
        uniAccount.toBuffer(),
        vireAccount.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .initializeStudent(255) // Max card number
      .accountsPartial({
        student: student.publicKey,
        studentAccount: studentPda,
        subjectAccount,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([student])
      .rpc();

    const studentState = await program.account.studentAccount.fetch(studentPda);
    assert.equal(studentState.cardNumber, 255);
  });

  it("Adds Subject", async () => {
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
      program.programId
    );

    await program.methods
      .addSubjects(10000, 8, 4, {
        name: "Test Subject",
        uri: "https://example.com"
      }) // tution_fee = 10000, max_semester = 8, semesterMonths = 30
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        subjectAccount: subjectPda,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([uniAdmin])
      .rpc();

    const subjectState = await program.account.subjectAccount.fetch(subjectPda);
    assert.equal(subjectState.tutionFee, 10000);
    assert.equal(subjectState.maxSemester, 8);
    assert.equal(subjectState.semesterMonths, 4);
  });

  it("Fails to Add Duplicate Subject", async () => {
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
      program.programId
    );

    await program.methods
      .addSubjects(10000, 8, 30, {
        name: "Duplicate Subject",
        uri: "https://example.com/duplicate"
      })
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        subjectAccount: subjectPda,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([uniAdmin])
      .rpc();

    try {
      await program.methods
        .addSubjects(10000, 8, 30, {
          name: "Duplicate Subject",
          uri: "https://example.com/duplicate"
        })
        .accountsPartial({
          uniAdmin: uniAdmin.publicKey,
          subjectAccount: subjectPda,
          uniAccount,
          vireAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([uniAdmin])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "SubjectAlreadyExists");
    }
  });

  it("Handles Maximum Tuition Fee Value", async () => {
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
      program.programId
    );

    await program.methods
      .addSubjects(4294967295, 8, 30, { // Max u32 value
        name: "Max Tuition Subject",
        uri: "https://example.com/max-tuition"
      })
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        subjectAccount: subjectPda,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([uniAdmin])
      .rpc();

    const subjectState = await program.account.subjectAccount.fetch(subjectPda);
    assert.equal(subjectState.tutionFee, 4294967295);
  });

  it("Fails to Add Subject with Unauthorized User", async () => {
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .addSubjects(10000, 8, 30, {
        name: "Test Subject",
        uri: "https://example.com"
      })
        .accountsPartial({
          uniAdmin: unauthorizedUser.publicKey,
          subjectAccount: subjectPda,
          uniAccount,
          vireAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedUser])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "Unauthorized");
    }
  });

  it("Pays Tution Fee", async () => {
    const [studentCardPda] = PublicKey.findProgramAddressSync(
      [
        studentAccount.toBuffer(),
        Buffer.from([1]), // card_number = 1
        subjectAccount.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .payTutionFee({
        name: "Test Card",
        uri: "https://example.com/card"
      })
      .accountsPartial({
        student: student.publicKey,
        studentAccount,
        studentCardAccount: studentCardPda,
        subjectAccount,
        uniAccount,
        vireAccount,
        studentAtaUsdc,
        uniAtaUsdc,
        treasury,
        mintUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([student])
      .rpc();

    const studentCardState = await program.account.studentCardAccount.fetch(studentCardPda);
    assert.equal(studentCardState.owner.toString(), student.publicKey.toString());
    assert.equal(studentCardState.owner.toString(), student.publicKey.toString());
    // assert(studentCardState.freezeAt > 0);
  });

  it("Fails to Pay Tution Fee with Insufficient Balance", async () => {
    const [studentCardPda] = PublicKey.findProgramAddressSync(
      [
        studentAccount.toBuffer(),
        Buffer.from([1]), // card_number = 1
        subjectAccount.toBuffer(),
      ],
      program.programId
    );

    // Empty student's ATA
    await mintTo(
      provider.connection,
      vireAdmin,
      mintUsdc,
      studentAtaUsdc,
      vireAdmin,
      0
    );

    try {
      await program.methods
        .payTutionFee({
          name: "Test Card",
          uri: "https://example.com/card"
        })
        .accountsPartial({
          student: student.publicKey,
          studentAccount,
          studentCardAccount: studentCardPda,
          subjectAccount,
          uniAccount,
          vireAccount,
          studentAtaUsdc,
          uniAtaUsdc,
          treasury,
          mintUsdc,
        })
        .signers([student])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "InsufficientBalance");
    }
});

  it("Unfreezes Card", async () => {
    const [studentCardPda] = PublicKey.findProgramAddressSync(
      [
        studentAccount.toBuffer(),
        Buffer.from([1]), // card_number = 1
        subjectAccount.toBuffer(),
      ],
      program.programId
    );

    // Simulate waiting for the freeze period to pass
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await program.methods
      .unstakeCard()
      .accountsPartial({
        student: student.publicKey,
        studentAccount,
        studentCardAccount: studentCardPda,
        subjectAccount,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([student])
      .rpc();

    const studentCardState = await program.account.studentCardAccount.fetch(studentCardPda);
    assert(studentCardState.freezeAt.eq(new BN(0))); // Use BN comparison
  });

  it("Fails to Unfreeze Card Before Freeze Period Ends", async () => {
    const [studentCardPda] = PublicKey.findProgramAddressSync(
      [
        studentAccount.toBuffer(),
        Buffer.from([1]), // card_number = 1
        subjectAccount.toBuffer(),
      ],
      program.programId
    );

    try {
      await program.methods
        .unstakeCard()
        .accountsPartial({
          student: student.publicKey,
          studentAccount,
          studentCardAccount: studentCardPda,
          subjectAccount,
          uniAccount,
          vireAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([student])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "CardCannotBeUnfrozenYet");
    }
  });

  it("Fails to Initialize Vire Twice", async () => {
    const [virePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vire"), vireAdmin.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeVire(5, 2)
      .accountsPartial({
        admin: vireAdmin.publicKey,
        vireAccount: virePda,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .signers([vireAdmin])
      .rpc();

    try {
      await program.methods
        .initializeVire(5, 2)
        .accountsPartial({
          admin: vireAdmin.publicKey,
          vireAccount: virePda,
          treasury,
          systemProgram: SystemProgram.programId,
        })
        .signers([vireAdmin])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "AlreadyInitialized");
    }
  });

  it("Handles Maximum Semester Value", async () => {
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
      program.programId
    );

    await program.methods
      .addSubjects(10000, 255, 30, {
        name: "Max Semester Subject",
        uri: "https://example.com/max"
      }) // Max semester value
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        subjectAccount: subjectPda,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([uniAdmin])
      .rpc();

    const subjectState = await program.account.subjectAccount.fetch(subjectPda);
    assert.equal(subjectState.maxSemester, 255);
  });

  it("Maintains Correct State After Multiple Operations", async () => {
    // Initialize Vire
    const [virePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vire"), vireAdmin.publicKey.toBuffer()],
      program.programId
    );
    await program.methods
      .initializeVire(5, 2)
      .accountsPartial({
        admin: vireAdmin.publicKey,
        vireAccount: virePda,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .signers([vireAdmin])
      .rpc();

    // Initialize Uni
    const [uniPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("uni"), uniAdmin.publicKey.toBuffer(), vireAccount.toBuffer()],
      program.programId
    );
    await program.methods
      .initializeUni()
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        uniAccount: uniPda,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([uniAdmin])
      .rpc();

    // Add Subject
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
      program.programId
    );
    await program.methods
      .addSubjects(10000, 8, 30, {
        name: "Test Subject",
        uri: "https://example.com"
      })
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        subjectAccount: subjectPda,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([uniAdmin])
      .rpc();

    // Verify final states
    const vireState = await program.account.vireAccount.fetch(virePda);
    const uniState = await program.account.uniAccount.fetch(uniPda);
    const subjectState = await program.account.subjectAccount.fetch(subjectPda);

    assert.equal(vireState.uniNumber, 1);
    assert.equal(uniState.subjectNumber, 1);
    assert.equal(subjectState.tutionFee, 10000);
  });

  it("Fails to Add Subject with Negative Tuition Fee", async () => {
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .addSubjects(
          -100, // Negative tuition fee
          8,    // maxSemester
          30,   // semesterMonths
          {     // args (createCardCollectionArgs)
            name: "Test Subject",
            uri: "https://example.com/test-subject"
          }
        )
        .accountsPartial({
          uniAdmin: uniAdmin.publicKey,
          subjectAccount: subjectPda,
          uniAccount,
          vireAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([uniAdmin])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "InvalidTuitionFee");
    }
  });

  it("Fails to Add Subject with Invalid URI", async () => {
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .addSubjects(10000, 8, 30, {
          name: "Invalid URI Subject",
          uri: "invalid-uri" // Invalid URI format
        })
        .accountsPartial({
          uniAdmin: uniAdmin.publicKey,
          subjectAccount: subjectPda,
          uniAccount,
          vireAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([uniAdmin])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "InvalidURI");
    }
  });

  it("Fails to Add Subject with Invalid Semester Months", async () => {
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .addSubjects(10000, 8, 0, { // Invalid semester months
          name: "Invalid Semester Subject",
          uri: "https://example.com/invalid"
        })
        .accountsPartial({
          uniAdmin: uniAdmin.publicKey,
          subjectAccount: subjectPda,
          uniAccount,
          vireAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([uniAdmin])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "InvalidSemesterMonths");
    }
  });

  it("Edits Vire Successfully", async () => {
    const [virePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vire"), vireAdmin.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .editVire(10, 5) // New fees: 10% uni, 5% student
      .accountsPartial({
        admin: vireAdmin.publicKey,
        vireAccount: virePda,
      })
      .signers([vireAdmin])
      .rpc();

    const vireState = await program.account.vireAccount.fetch(virePda);
    assert.equal(vireState.transactionFeeUni, 10);
    assert.equal(vireState.transactionFeeStudent, 5);
  });

  it("Fails to Edit Vire with Unauthorized User", async () => {
    const [virePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vire"), vireAdmin.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .editVire(10, 5)
        .accountsPartial({
          admin: unauthorizedUser.publicKey,
          vireAccount: virePda,
        })
        .signers([unauthorizedUser])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "Unauthorized");
    }
  });

  it("Edits Subject Successfully", async () => {
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
      program.programId
    );

    await program.methods
      .editSubject(15000, 10, 6) // New values: tuition=15000, max_semester=10, semester_months=6
      .accountsPartial({
        uniAdmin: uniAdmin.publicKey,
        subjectAccount: subjectPda,
      })
      .signers([uniAdmin])
      .rpc();

    const subjectState = await program.account.subjectAccount.fetch(subjectPda);
    assert.equal(subjectState.tutionFee, 15000);
    assert.equal(subjectState.maxSemester, 10);
    assert.equal(subjectState.semesterMonths, 6);
  });

  it("Fails to Edit Subject with Unauthorized User", async () => {
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [uniAccount.toBuffer(), Buffer.from([0]), vireAccount.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .editSubject(15000, 10, 6)
        .accountsPartial({
          uniAdmin: unauthorizedUser.publicKey,
          subjectAccount: subjectPda,
        })
        .signers([unauthorizedUser])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "Unauthorized");
    }
  });

  it("Unstakes Card Successfully", async () => {
    const [studentCardPda] = PublicKey.findProgramAddressSync(
      [
        studentAccount.toBuffer(),
        Buffer.from([1]), // card_number = 1
        subjectAccount.toBuffer(),
      ],
      program.programId
    );

    // Simulate waiting for the freeze period to pass
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await program.methods
      .unstakeCard()
      .accountsPartial({
        student: student.publicKey,
        studentAccount,
        studentCardAccount: studentCardPda,
        subjectAccount,
        uniAccount,
        vireAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([student])
      .rpc();

    const studentCardState = await program.account.studentCardAccount.fetch(studentCardPda);
    assert(studentCardState.freezeAt.eq(new BN(0))); // Use BN comparison
  });

  it("Fails to Unstake Card Before Freeze Period Ends", async () => {
    const [studentCardPda] = PublicKey.findProgramAddressSync(
      [
        studentAccount.toBuffer(),
        Buffer.from([1]), // card_number = 1
        subjectAccount.toBuffer(),
      ],
      program.programId
    );

    try {
      await program.methods
        .unstakeCard()
        .accountsPartial({
          student: student.publicKey,
          studentAccount,
          studentCardAccount: studentCardPda,
          subjectAccount,
          uniAccount,
          vireAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([student])
        .rpc();
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "CardCannotBeUnfrozenYet");
    }
  });

});


