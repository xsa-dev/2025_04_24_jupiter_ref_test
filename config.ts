import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import dotenv from "dotenv"
import base58 from "bs58"


dotenv.config()

export const serverConfig = {
    KEY: process.env.KEY!,
    HTTPS_RPC: process.env.HTTPS_RPC!,
    WSS_RPC: process.env.WSS_RPC!,
    ADMIN_WALLET: process.env.ADMIN_WALLET!,
    REFERRAL_WALLET: process.env.REFERRAL_WALLET!,
    ADMIN_FEE_BPS: process.env.ADMIN_FEE_BPS!,
    TOTAL_FEE_BPS: process.env.TOTAL_FEE_BPS!
}

export const connection = new Connection(serverConfig.HTTPS_RPC, { wsEndpoint: serverConfig.WSS_RPC })

export const payer = Keypair.fromSecretKey(base58.decode(serverConfig.KEY))
console.log(payer.publicKey.toBase58())

export const adminPubkey = new PublicKey(serverConfig.ADMIN_WALLET);

export const referralPubkey = new PublicKey(serverConfig.REFERRAL_WALLET);

export const adminFeeBps = serverConfig.ADMIN_FEE_BPS;

export const totalFeeBps = serverConfig.TOTAL_FEE_BPS;


export const JUPITER_PROGRAM = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4")

export const REF_PROGRAM = new PublicKey("refbboVscic9xb6FCLZyzZ9T6pEeiYyDVvyjetQa4BB")

export const jitoUrls = [
    "https://mainnet.block-engine.jito.wtf",
    "https://frankfurt.mainnet.block-engine.jito.wtf",
    "https://amsterdam.mainnet.block-engine.jito.wtf",
    "https://ny.mainnet.block-engine.jito.wtf",
    "https://tokyo.mainnet.block-engine.jito.wtf",
    "https://slc.mainnet.block-engine.jito.wtf"
];

export const jitoTipAccounts = [
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
];