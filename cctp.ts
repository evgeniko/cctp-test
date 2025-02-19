import type { Network, Signer, TransactionId, Wormhole } from "@wormhole-foundation/sdk";
import { CircleTransfer, amount, wormhole } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";
import solana from "@wormhole-foundation/sdk/solana";
import evmPlatform from "@wormhole-foundation/sdk/platforms/evm";
import { getSigner, SignerStuff } from "./utils";

/*
Notes:
Only a subset of chains are supported by Circle for CCTP, see core/base/src/constants/circle.ts for currently supported chains

AutoRelayer takes a 0.1usdc fee when xfering to any chain beside goerli, which is 1 usdc
*/
//

(async function () {
  // init Wormhole object, passing config for which network
  // to use (e.g. Mainnet/Testnet) and what Platforms to support
  const wh = await wormhole("Testnet", [evm, solana]);

  // Grab chain Contexts
  const sendChain = wh.getChain("Sepolia");
  const rcvChain = wh.getChain("Solana");

  const tokenAddress = new evmPlatform.Address("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238").toUniversalAddress();
  const balance = await sendChain.getBalance("0xCC0D31E242A2E18Ed3f2Fb16C45C87B4187e8F88", tokenAddress);
  console.log("USDC balance:", balance);

  // Get signer from local key but anything that implements
  // Signer interface (e.g. wrapper around web wallet) should work
  const source = await getSigner(sendChain);
  const destination = await getSigner(rcvChain);

  // 6 decimals for USDC (except for bsc, so check decimals before using this)
  const amt = amount.units(amount.parse("3.0", 6));

  // Choose whether or not to have the attestation delivered for you
  const automatic = false;

  // If the transfer is requested to be automatic, you can also request that
  // during redemption, the receiver gets some amount of native gas transferred to them
  // so that they may pay for subsequent transactions
  // The amount specified here is denominated in the token being transferred (USDC here)
  const nativeGas = automatic ? amount.units(amount.parse("0.0", 6)) : 0n;

  await cctpTransfer(wh, source, destination, {
    amount: amt,
    automatic,
    nativeGas,
  });

  // Note: you can pick up a partial transfer from the origin chain name and txid
  // once created, you can call `fetchAttestations` and `completeTransfer` assuming its a manual transfer.
  // This is especially helpful for chains with longer time to finality where you don't want
  // to have to wait for the attestation to be generated.
  // await completeTransfer(
  //   wh,
  //   {
  //     chain: sendChain.chain,
  //     txid: "0x6b431a9172f6c672976294b3a3d6cd79f46a7d6247440c0934af4bfc2b5ad957",
  //   },
  //   destination.signer,
  // );
})();

async function cctpTransfer<N extends Network>(
  wh: Wormhole<N>,
  src: SignerStuff<N, any>,
  dst: SignerStuff<N, any>,
  req: {
    amount: bigint;
    automatic: boolean;
    nativeGas?: bigint;
  },
) {
  // EXAMPLE_CCTP_TRANSFER
  const xfer = await wh.circleTransfer(
    // amount as bigint (base units)
    req.amount,
    // sender chain/address
    src.address,
    // receiver chain/address
    dst.address,
    // automatic delivery boolean
    req.automatic,
    // payload to be sent with the transfer
    Buffer.from("GM"),
    // If automatic, native gas can be requested to be sent to the receiver
    req.nativeGas,
  );

  // Note, if the transfer is requested to be Automatic, a fee for performing the relay
  // will be present in the quote. The fee comes out of the amount requested to be sent.
  // If the user wants to receive 1.0 on the destination, the amount to send should be 1.0 + fee.
  // The same applies for native gas dropoff
  const quote = await CircleTransfer.quoteTransfer(src.chain, dst.chain, xfer.transfer);
  console.log("Quote", quote);

  console.log("Starting Transfer");
  const srcTxids = await xfer.initiateTransfer(src.signer);
  console.log(`Started Transfer: `, srcTxids);

  // Note: Depending on chain finality, this timeout may need to be increased.
  // See https://developers.circle.com/stablecoin/docs/cctp-technical-reference#mainnet for more
  console.log("Waiting for Attestation");
  const attestIds = await xfer.fetchAttestation(60_000);
  console.log(`Got Attestation: `, attestIds);

  console.log("Completing Transfer");
  const dstTxids = await xfer.completeTransfer(dst.signer);
  console.log(`Completed Transfer: `, dstTxids);
  // EXAMPLE_CCTP_TRANSFER
}

export async function completeTransfer(
  wh: Wormhole<Network>,
  txid: TransactionId,
  signer: Signer,
): Promise<void> {
  // EXAMPLE_RECOVER_TRANSFER
  // Rebuild the transfer from the source txid
  const xfer = await CircleTransfer.from(wh, txid);

  const attestIds = await xfer.fetchAttestation(60 * 60 * 1000);
  console.log("Got attestation: ", attestIds);

  const dstTxIds = await xfer.completeTransfer(signer);
  console.log("Completed transfer: ", dstTxIds);
  // EXAMPLE_RECOVER_TRANSFER
}