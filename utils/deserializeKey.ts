import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import bs58 from 'bs58';

async function deserializeKey() {
  try {
    // Read the private key array from the JSON file
    const keyPath = path.join(process.cwd(), 'solana-mainnet-keypair.json');
    const keyData: number[] = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    
    // Convert the number array to Uint8Array
    const secretKey = new Uint8Array(keyData);
    
    // Create a keypair from the secret key
    const keypair = Keypair.fromSecretKey(secretKey);
    
    // Get the base58 encoded private key using bs58
    const privateKey = bs58.encode(keypair.secretKey);
    
    console.log('Your Solana private key (base58):', privateKey);
    console.log('Corresponding public key:', keypair.publicKey.toBase58());
    
    return privateKey;
  } catch (error) {
    console.error('Error deserializing private key:', error);
    throw error;
  }
}

deserializeKey().catch(console.error);
