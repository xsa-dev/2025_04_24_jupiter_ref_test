import { VersionedTransaction } from "@solana/web3.js";
import axios from "axios";
import base58 from "bs58";
import { connection, jitoUrls } from "./config";

export const sendTxsUsingJito = async (
    txs: VersionedTransaction[]
) => {
    const result = await Promise.any([
        ...jitoUrls.map(async (url, index) => {
            try {
                const res = await axios.post(
                    `${url}/api/v1/bundles`,
                    {
                        id: 1,
                        jsonrpc: "2.0",
                        method: "sendBundle",
                        params: [
                            [
                                ...txs.map((tx) =>
                                    Buffer.from(tx.serialize()).toString("base64")
                                ),
                            ],
                            {
                                encoding: "base64",
                            },
                        ],
                    },
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                return { result: res.data.result, index };
            } catch {
                // console.log(`jito sendBundle error: ${url}`);
                return undefined;
            }
        }),
    ]);
    console.log(`${JSON.stringify(result, null, 2)}`)
    const recentBlockhash = await connection.getLatestBlockhash("finalized")
    const txid = base58.encode(txs[0]!.signatures[0]!);
    try {
        await connection.confirmTransaction(
            {
                signature: txid,
                ...recentBlockhash,
            },
            "confirmed"
        );
        let txUrl = `https://solscan.io/tx/${txid}`;
        console.log(`${txUrl}`)
        return { result: true, txUrl };
    } catch (err) {
        return { result: false, txUrl: "" };
    }
};