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
    const address = data?.result?.verifications?.[0] || null

    if (!address) {
      console.warn(`[Warpcast API] No verified address found for FID: ${fid}`)
    } else {
      console.log(`[Warpcast API] Verified address found: ${address}`)
    }

    return address
  } catch (error) {
    console.error("[Warpcast API] Error fetching verified address:", error)
    return null
  }
}

const handleRequest = frames(async (ctx) => {
  try {
    console.log("[Frames.js] Incoming request:", JSON.stringify(ctx, null, 2))

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
      console.error("[Frames.js] Missing FID in request")
      return {
        image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
        buttons: [
          <Button action="post" target={{ query: { state: true } }}>
            Try again
          </Button>,
        ],
      }
    }

    console.log(`[Frames.js] Extracted FID: ${fid}`)

    const userAddress = await getVerifiedAddress(fid)
    if (!userAddress) {
      console.warn("[Warpcast API] User has no verified Ethereum address")
      return {
        image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/no_address.png?raw=true",
        buttons: [
          <Button action="post" target={{ query: { state: true } }}>
            Try again
          </Button>,
        ],
      }
    }

    console.log(`[Frames.js] Verified address for FID ${fid}: ${userAddress}`)

    const { data, error } = await supabase
      .from("fox_claims")
      .select("claimed_at", { count: "exact" })
      .eq("fid", fid)
      .order("claimed_at", { ascending: false })
      .limit(1)

    if (error) {
      console.error("[Supabase] Error fetching claim history:", error)
      return {
        image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
        buttons: [
          <Button action="post" target={{ query: { state: true } }}>
            Try again
          </Button>,
        ],
      }
    }

    console.log(`[Supabase] Last claim data for FID ${fid}:`, data)

    const lastInteractionTime = checkInteractionTime(data)

    if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
      console.warn(`[Frames.js] Cooldown active for FID ${fid}: ${lastInteractionTime.formattedTime}`)
      return {
        image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/wait.png?raw=true",
        buttons: [
          <Button action="post" target={{ query: { state: true } }}>
            {`Try again in ${lastInteractionTime.formattedTime}`}
          </Button>,
        ],
      }
    }

    console.log(`[Frames.js] No active cooldown for FID ${fid}, proceeding with claim`)

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
    } catch (txError) {
      console.error("[Blockchain] Transaction failed:", txError)
      return {
        image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/tx_error.png?raw=true",
        buttons: [
          <Button action="post" target={{ query: { state: true } }}>
            Try again
          </Button>,
        ],
      }
    }

    const { error: insertError } = await supabase.from("fox_claims").insert([
      {
        fid: fid,
        eth_address: userAddress,
        claimed_at: new Date().toISOString(),
      },
    ])

    if (insertError) {
      console.error("[Supabase] Error inserting claim:", insertError)
      return {
        image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
        buttons: [
          <Button action="post" target={{ query: { state: true } }}>
            Try again
          </Button>,
        ],
      }
    }

    console.log(`[Supabase] Claim successfully saved for FID ${fid}`)

    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claimed.png?raw=true",
      buttons: [
        <Button action="link" target={`https://basescan.org/tx/${receipt}`}>
          See on Base Scan
        </Button>,
      ],
    }
  } catch (err) {
    console.error("[Frames.js] Unexpected server error:", err)
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }
})

export const GET = handleRequest
export const POST = handleRequest
