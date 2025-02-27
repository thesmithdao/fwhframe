import { ABI } from "@/lib/abi"
import { FOX_CONTRACT } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import { checkInteractionTime } from "@/lib/utils"
import { account, publicClient, walletClient } from "@/lib/web3-client"
import { createFrames, Button } from "frames.js/next"
import { CSSProperties } from "react"
import { parseUnits } from "viem"

const WARPCAST_API_KEY = process.env.WARPCAST_API_KEY

const frames = createFrames({
  basePath: "/frames",
})

const div_style: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  backgroundColor: "black",
  height: "100%",
  width: "100%",
  justifyContent: "center",
  color: "#00FF41",
  textShadow: "0 0 4px #00FF41,0 0 5px #00FF41,0 0 5px #00FF41",
  filter: "blur(0.02rem)",
}

// Fetch the user's verified Ethereum address from Warpcast API
const getVerifiedAddress = async (fid: number) => {
  try {
    const response = await fetch(`https://api.warpcast.com/v2/verifications?fid=${fid}`, {
      headers: {
        Authorization: `Bearer ${WARPCAST_API_KEY}`,
        "Content-Type": "application/json",
      },
    })
    const data = await response.json()
    return data?.result?.verifications?.[0] || null
  } catch {
    return null
  }
}

const handleRequest = frames(async (ctx) => {
  if (ctx.request.method === "GET") {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claim.gif?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          🦊 Claim Fox
        </Button>,
      ],
    }
  }

  const fid = ctx.message?.requesterFid
  if (!fid) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }

  const userAddress = await getVerifiedAddress(fid)
  if (!userAddress) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/no_address.png?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }

  const { data } = await supabase
    .from("fox_claims")
    .select("claimed_at", { count: "exact" })
    .eq("fid", fid)
    .order("claimed_at", { ascending: false })
    .limit(1)

  const lastInteractionTime = checkInteractionTime(data)

  if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/wait.png?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          {`Try again in ${lastInteractionTime.formattedTime}`}
        </Button>,
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
  } catch {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/tx_error.png?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }

  await supabase.from("fox_claims").insert([
    {
      fid: fid,
      eth_address: userAddress,
      claimed_at: new Date().toISOString(),
    },
  ])

  return {
    image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claimed.png?raw=true",
    buttons: [
      <Button action="link" target={`https://basescan.org/tx/${receipt}`}>
        See on Base Scan
      </Button>,
    ],
  }
})

export const GET = handleRequest
export const POST = handleRequest
