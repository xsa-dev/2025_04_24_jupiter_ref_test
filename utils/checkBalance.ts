import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

async function checkBalance() {
  try {
    // Read the private key from the JSON file
    const keyPath = path.join(process.cwd(), 'keys/solana-mainnet-keypair.json');
    const keyData: number[] = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    
    // Create a keypair from the secret key
    const secretKey = new Uint8Array(keyData);
    const keypair = Keypair.fromSecretKey(secretKey);
    
    // Connect to the Solana mainnet
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    
    // Get the balance
    const balance = await connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log('Public key:', keypair.publicKey.toBase58());
    console.log(`Balance: ${solBalance} SOL (${balance} lamports)`);
    
    return { publicKey: keypair.publicKey.toBase58(), balance, solBalance };
  } catch (error) {
    console.error('Error checking balance:', error);
    throw error;
  }
}

checkBalance().catch(console.error);
