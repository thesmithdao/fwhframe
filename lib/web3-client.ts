import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { mainnet } from "viem/chains"

const account = privateKeyToAccount(
  process.env.WALLET_PRIVATE_KEY as `0x${string}`
)

export const client = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
})
