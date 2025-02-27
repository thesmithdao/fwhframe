import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

export const chain = base

export const account = privateKeyToAccount(
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
