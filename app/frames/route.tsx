import { ABI } from "@/lib/abi"
import { FOX_CONTRACT } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import { checkInteractionTime } from "@/lib/utils"
import { account, publicClient, walletClient } from "@/lib/web3-client"
import { farcasterHubContext } from "frames.js/middleware"
import { createFrames } from "frames.js/next"
import { parseUnits } from "viem"

const WARPCAST_API_KEY = process.env.WARPCAST_API_KEY

const frames = createFrames({
  basePath: "/frames",
  middleware: [
    farcasterHubContext({
      ...(process.env.NODE_ENV === "production"
        ? {}
        : {
            hubHttpUrl: "http://localhost:3010/hub",
          }),
    }),
  ],
})

// Fetch the user's verified Ethereum address from Farcaster API
const getVerifiedAddress = async (fid: number): Promise<`0x${string}` | null> => {
  try {
    console.log(`[Warpcast API] Fetching verified address for FID: ${fid}`)
    const response = await fetch(`https://api.warpcast.com/v2/verifications?fid=${fid}`, {
      headers: {
        Authorization: `Bearer ${WARPCAST_API_KEY}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      console.error(`[Warpcast API] Error response: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()
    let verification = data?.result?.verifications?.[0] || ""

    if (typeof verification !== "string") {
      console.warn(`[Warpcast API] No valid Ethereum address found for FID: ${fid}`)
      return null
    }

    if (!verification.startsWith("0x")) {
      verification = `0x${verification}`
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(verification)) {
      console.error(`[Warpcast API] Invalid Ethereum address format: ${verification}`)
      return null
    }

    console.log(`[Warpcast API] Verified Ethereum address: ${verification}`)
    return verification as `0x${string}`
  } catch (error) {
    console.error("[Warpcast API] Error fetching verified address:", error)
    return null
  }
}

const handleRequest = frames(async (ctx) => {
  console.log("[Frames.js] Incoming request:", JSON.stringify(ctx, null, 2))

  const message = ctx.message

  if (!message) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claim.gif?raw=true",
      buttons: [
        {
          action: "post",
          target: { query: { state: true } },
          label: "🦊 Claim Fox",
        },
      ],
    }
  }

  const userAddress = await getVerifiedAddress(message.requesterFid)
  if (!userAddress) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/no_address.png?raw=true",
      buttons: [
        {
          action: "post",
          target: { query: { state: true } },
          label: "Try again",
        },
      ],
    }
  }

  console.log(`[Frames.js] Verified address for FID ${message.requesterFid}: ${userAddress}`)

  const { data, error } = await supabase
    .from("fox_claims")
    .select("claimed_at", { count: "exact" })
    .eq("fid", message?.requesterFid)
    .order("claimed_at", { ascending: false })
    .limit(1)

  if (error) {
    console.error("[Supabase] Error fetching claim history:", error)
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
      buttons: [
        {
          action: "post",
          target: { query: { state: true } },
          label: "Try again",
        },
      ],
    }
  }

  const lastInteractionTime = checkInteractionTime(data)

  if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/wait.png?raw=true",
      buttons: [
        {
          action: "post",
          target: { query: { state: true } },
          label: `Try again in ${lastInteractionTime.formattedTime}`,
        },
      ],
    }
  }

  let receipt = ""
  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: FOX_CONTRACT,
      abi: ABI,
      functionName: "transfer",
      args: [userAddress, parseUnits("0.000333", 18)],
    })
    receipt = await walletClient.writeContract(request)
    console.log(`[Blockchain] Transaction sent, receipt: ${receipt}`)
  } catch (e: any) {
    console.error("[Blockchain] Transaction failed:", e)
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/tx_error.png?raw=true",
      buttons: [
        {
          action: "post",
          target: { query: { state: true } },
          label: "Try again",
        },
      ],
    }
  }

  const save = await supabase.from("fox_claims").insert({
    fid: message?.requesterFid,
    f_address: message?.requesterCustodyAddress,
    eth_address: userAddress,
  })

  if (save.error) {
    console.error("[Supabase] Error inserting claim:", save.error)
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
      buttons: [
        {
          action: "post",
          target: { query: { state: true } },
          label: "Try again",
        },
      ],
    }
  }

  console.log(`[Supabase] Claim successfully saved for FID ${message.requesterFid}`)

  return {
    image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claimed.png?raw=true",
    buttons: [
      {
        action: "link",
        target: `https://basescan.org/tx/${receipt}`,
        label: "See on Base Scan",
      },
    ],
  }
})

export const GET = handleRequest
export const POST = handleRequest
