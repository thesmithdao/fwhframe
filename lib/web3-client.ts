import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"

const chain = baseSepolia

const account = privateKeyToAccount(
  process.env.WALLET_PRIVATE_KEY as `0x${string}`
)

export const walletClient = createWalletClient({
  account,
  chain,
  transport: http(),
})

export const publicClient = createPublicClient({
  chain,
  transport: http(),
})
