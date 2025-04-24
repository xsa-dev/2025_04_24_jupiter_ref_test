import type { Instruction } from "@jup-ag/api";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AddressLookupTableAccount, ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, type AccountMeta } from "@solana/web3.js";
import axios from "axios";
import { adminFeeBps, adminPubkey, connection, jitoTipAccounts, JUPITER_PROGRAM, payer, REF_PROGRAM, referralPubkey, totalFeeBps } from "./config";
import { sendTxsUsingJito } from "./jito";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
const USDC_Mint = new PublicKey(USDC)

const deserializeInstruction = (instruction: Instruction) => {
    return new TransactionInstruction({
        programId: new PublicKey(instruction.programId),
        keys: instruction.accounts.map((key) => ({
            pubkey: new PublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
        })),
        data: Buffer.from(instruction.data, "base64"),
    });
};
const getAddressLookupTableAccounts = async (
    keys: string[]
): Promise<AddressLookupTableAccount[]> => {
    const addressLookupTableAccountInfos =
        await connection.getMultipleAccountsInfo(
            keys.map((key) => new PublicKey(key))
        );

    return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
        const addressLookupTableAddress = keys[index];
        if (accountInfo) {
            const addressLookupTableAccount = new AddressLookupTableAccount({
                key: new PublicKey(addressLookupTableAddress!),
                state: AddressLookupTableAccount.deserialize(accountInfo.data),
            });
            acc.push(addressLookupTableAccount);
        }

        return acc;
    }, new Array<AddressLookupTableAccount>());
};

const accountMeta = ({ pubkey, isWritable = true, isSigner = false }: { pubkey: PublicKey, isWritable?: boolean, isSigner?: boolean }) => {
    return {
        pubkey: pubkey, isWritable, isSigner
    } as AccountMeta
}
const slippageBps = 100;

const swapFeeToUsdcTx = async (inputMint: string, inputAmount: number, latestBlockhash: string) => {
    try {
        const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${USDC}&amount=${inputAmount}&slippageBps=${slippageBps}&maxAccounts=32`
        const { data: quoteResponse } = await axios.get(url,
            {
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        )
        const { data: swapResponse } = await
            axios.post(`https://lite-api.jup.ag/swap/v1/swap-instructions`, {
                quoteResponse: quoteResponse,
                userPublicKey: payer.publicKey.toString(),
                useSharedAccounts: true,
                wrapAndUnwrapSol: true
            }, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });
        const {
            setupInstructions, // Setup missing ATA for the users.
            swapInstruction: swapInstructionPayload, // The actual swap instruction.
            addressLookupTableAddresses,
        } = swapResponse;
        const addressLookupTableAddressesList: Set<string> = new Set([...addressLookupTableAddresses])


        const addressLookupTableAccounts: AddressLookupTableAccount[] = [];

        addressLookupTableAccounts.push(
            ...(await getAddressLookupTableAccounts([...addressLookupTableAddressesList]))
        );
        const payerUsdcAta = getAssociatedTokenAddressSync(new PublicKey(USDC), payer.publicKey);
        const adminUsdcAta = getAssociatedTokenAddressSync(new PublicKey(USDC), adminPubkey);
        const referralUsdcAta = getAssociatedTokenAddressSync(new PublicKey(USDC), referralPubkey);

        const swapFeeIX = deserializeInstruction(swapInstructionPayload);
        const keys = [
            accountMeta({ pubkey: payer.publicKey, isSigner: true }),
            accountMeta({ pubkey: payerUsdcAta }),
            accountMeta({ pubkey: adminUsdcAta }),
            accountMeta({ pubkey: referralUsdcAta }),
            accountMeta({ pubkey: JUPITER_PROGRAM }),
            accountMeta({ pubkey: TOKEN_PROGRAM_ID }),
            ...swapFeeIX.keys];

        const jupiterData = swapFeeIX.data;
        const jupiterDataLen = jupiterData.length;
        const data = Buffer.alloc(jupiterDataLen + 8)
        data.writeBigUInt64LE(BigInt(adminFeeBps), 0)
        jupiterData.copy(data, 8);
        const ix = new TransactionInstruction({
            keys, data, programId: REF_PROGRAM
        })
        const ixs = [
            createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, payerUsdcAta, payer.publicKey, USDC_Mint),
            createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, adminUsdcAta, adminPubkey, USDC_Mint),
            createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, referralUsdcAta, referralPubkey, USDC_Mint),
        ]
        setupInstructions.length && ixs.push(...setupInstructions.map((ix: Instruction) => deserializeInstruction(ix)))
        ixs.push(ix)
        const msg = new TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: latestBlockhash,
            instructions: [
                ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
                // ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
                ...ixs]
        }).compileToV0Message(addressLookupTableAccounts);
        const tx = new VersionedTransaction(msg);
        const simul = await connection.simulateTransaction(tx, { replaceRecentBlockhash: true });
        console.log(`swapFeeTx: ${simul.value.unitsConsumed}`)
        // console.log(JSON.stringify(simul.value.logs, null, 2))
        if (simul.value.err) {
            console.log(simul.value.err)
            return null;
        }
        // return { ixs, addressLookupTableAccounts };
        tx.sign([payer])
        return tx
    } catch (e) {
        console.error(e)
        return null;
    }
}



const swapViaJupiterTx = async (inputMint: string, outputMint: string, inputAmount: number, latestBlockhash: string) => {
    try {
        const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${inputAmount}&slippageBps=${slippageBps}&maxAccounts=32`
        const { data: quoteResponse } = await axios.get(url,
            {
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        )
        const { data: swapResponse } = await
            axios.post(`https://lite-api.jup.ag/swap/v1/swap-instructions`, {
                quoteResponse: quoteResponse,
                userPublicKey: payer.publicKey.toString(),
                useSharedAccounts: true,
                wrapAndUnwrapSol: true
            }, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });
        const {
            setupInstructions, // Setup missing ATA for the users.
            swapInstruction: swapInstructionPayload, // The actual swap instruction.
            cleanupInstruction, // Unwrap the SOL if `wrapAndUnwrapSol = true`.
            addressLookupTableAddresses,
        } = swapResponse;
        const addressLookupTableAddressesList: Set<string> = new Set([...addressLookupTableAddresses])


        const addressLookupTableAccounts: AddressLookupTableAccount[] = [];

        addressLookupTableAccounts.push(
            ...(await getAddressLookupTableAccounts([...addressLookupTableAddressesList]))
        );

        const ixs: TransactionInstruction[] = [];
        setupInstructions ? ixs.push(...setupInstructions.map((ix: Instruction) => deserializeInstruction(ix))) : null;
        ixs.push(deserializeInstruction(swapInstructionPayload))
        cleanupInstruction ? ixs.push(deserializeInstruction(cleanupInstruction)) : null;
        const msg = new TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: latestBlockhash,
            instructions: [
                ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
                // ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
                ...ixs]
        }).compileToV0Message(addressLookupTableAccounts);
        const tx = new VersionedTransaction(msg);
        const simul = await connection.simulateTransaction(tx, { replaceRecentBlockhash: true });
        // console.log(JSON.stringify(simul.value.logs, null, 2))
        console.log(`swapMainTx: ${simul.value.unitsConsumed}`)
        if (simul.value.err) {
            console.log(simul.value.err)
            return null;
        }
        tx.sign([payer])
        // return { ixs, addressLookupTableAccounts }
        return tx
    } catch (e) {
        console.error(e)
        return null;

    }
}

const WIF = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
// swapFeeToUsdcTx(WIF, 4000000, adminFeeBps)

// swapViaJupiterTx(WIF, USDC, 40000000)
const jitoTipLamports = 100_000;

const main = async (inputMint: string, outputMint: string, inputAmount: number) => {
    const totalFeeAmount = Math.floor(inputAmount * Number(totalFeeBps) / 10000);
    const inputAmountWithoutFee = inputAmount - totalFeeAmount;
    const latestBlockhash = await connection.getLatestBlockhash("confirmed")
    const swapFeeTx = await swapFeeToUsdcTx(inputMint, totalFeeAmount, latestBlockhash.blockhash)
    const swapMainTx = await swapViaJupiterTx(inputMint, outputMint, inputAmountWithoutFee, latestBlockhash.blockhash)
    if (swapFeeTx && swapMainTx) {
        const jitoTx = new VersionedTransaction(new TransactionMessage({
            payerKey: payer.publicKey, recentBlockhash: latestBlockhash.blockhash, instructions: [
                SystemProgram.transfer({
                    fromPubkey: payer.publicKey,
                    toPubkey: new PublicKey(jitoTipAccounts[Math.floor(Math.random() * jitoTipAccounts.length)]!),
                    lamports: jitoTipLamports
                })
            ]
        }).compileToV0Message())
        jitoTx.sign([payer])
        const simul = await connection.simulateTransaction(jitoTx, { replaceRecentBlockhash: true })
        // console.log(JSON.stringify(simul.value.logs, null, 2))
        console.log(`jitoTx: ${simul.value.unitsConsumed}`)
        if (simul.value.err) {
            console.log(simul.value.err)
            return
        }
        await sendTxsUsingJito([jitoTx, swapFeeTx, swapMainTx])
    } else {
        console.log(`Error while making transactions.`)
    }
}

main(WIF, USDT, 1000000)