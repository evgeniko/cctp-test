import {
    Chain,
    ChainAddress,
    ChainContext,
    Network,
    Signer,
    Wormhole,
    amount,
    encoding,
  } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/platforms/evm";
import solana from "@wormhole-foundation/sdk/platforms/solana";
  
  
  // Use .env.example as a template for your .env file and populate it with secrets
  // for funded accounts on the relevant chain+network combos to run the example
  
  function getEnv(key: string, dev?: string): string {
    // If we're in the browser, return empty string
    if (typeof process === undefined) return "";
    // Otherwise, return the env var or error
    const val = process.env[key];
    if (!val) {
      if (dev) return dev;
      throw new Error(
        `Missing env var ${key}, did you forget to set values in '.env'?`
      );
    }
  
    return val;
  }
  
  export interface SignerStuff<N extends Network, C extends Chain = Chain> {
    chain: ChainContext<N, C>;
    signer: Signer<N, C>;
    address: ChainAddress<C>;
  }
  
  const DEVNET_SOL_PRIVATE_KEY = encoding.b58.encode(
    new Uint8Array([
        72,52, // rest of the private key
    ])
  );
  
  export async function getSigner<N extends Network, C extends Chain>(
    chain: ChainContext<N, C>,
  ): Promise<SignerStuff<N, C>> {
    // Read in from `.env`
    (await import("dotenv")).config();
  
    let signer: Signer;
    const platform = chain.platform.utils()._platform;
    switch (platform) {
      case "Solana":
        signer = await solana.getSigner(
          await chain.getRpc(),
          getEnv("OTHER_SOL_PRIVATE_KEY", DEVNET_SOL_PRIVATE_KEY),
          { debug: false }
        );
  
        break;
      case "Evm":
        signer = await evm.getSigner(await chain.getRpc(), getEnv("ETH_PRIVATE_KEY"), {
          debug: true,
          maxGasLimit: amount.units(amount.parse("0.01", 18)),
          // overrides is a Partial<TransactionRequest>, so any fields can be overriden
          //overrides: {
          //  maxFeePerGas: amount.units(amount.parse("1.5", 9)),
          //  maxPriorityFeePerGas: amount.units(amount.parse("0.1", 9)),
          //},
        });
        break;
    //   case "Sui":
    //     signer = await sui.getSigner(await chain.getRpc(), getEnv("SUI_PRIVATE_KEY"));
    //     break;
      default:
        throw new Error("Unrecognized platform: " + platform);
    }
  
    return {
      chain,
      signer: signer as Signer<N, C>,
      address: Wormhole.chainAddress(chain.chain, signer.address()),
    };
  }
  