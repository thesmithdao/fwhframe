import { ABI } from "@/lib/abi"
import { FOX_CONTRACT } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import { checkInteractionTime } from "@/lib/utils"
import { account, publicClient, walletClient } from "@/lib/web3-client"
import { createFrames } from "frames.js/next" 
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
  } catch (error) {
    console.error("Error fetching Farcaster address:", error)
    return null
  }
}

const handleRequest = frames(async (ctx) => {
  console.log("CTX OBJECT RECEIVED:", JSON.stringify(ctx, null, 2))

  if (ctx.request.method === "GET") {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claim.gif?raw=true",
      buttons: [
        {
          action: "post",
          target: "/frames?state=true",
          label: "🦊 Claim Fox",
        } as const, 
      ],
    }
  }

  // Extract FID from Farcaster request
  const fid = ctx.message?.requesterFid
  if (!fid) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
      buttons: [
        {
          action: "post",
          target: "/frames?state=true",
          label: "Try again",
        } as const,
      ],
    }
  }

  console.log("Extracted FID:", fid)

  // Fetch the verified Ethereum address from Warpcast API
  const userAddress = await getVerifiedAddress(fid)
  if (!userAddress) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/no_address.png?raw=true",
      buttons: [
        {
          action: "post",
          target: "/frames?state=true",
          label: "Try again",
        } as const,
      ],
    }
  }

  console.log("User Address Extracted:", userAddress)

  // Fetch last claim record
  const { data, error } = await supabase
    .from("fox_claims")
    .select("claimed_at", { count: "exact" })
    .eq("fid", fid)
    .order("claimed_at", { ascending: false })
    .limit(1)

  if (error) {
    console.error("Error fetching claim history:", error)
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
      buttons: [
        {
          action: "post",
          target: "/frames?state=true",
          label: "Try again",
        } as const,
      ],
    }
  }

  console.log("Last Claim Data:", JSON.stringify(data, null, 2))

  const lastInteractionTime = checkInteractionTime(data)

  // If claim cooldown period is active
  if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
    console.log("Cooldown Active:", lastInteractionTime.formattedTime)
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/wait.png?raw=true",
      buttons: [
        {
          action: "post",
          target: "/frames?state=true",
          label: `Try again in ${lastInteractionTime.formattedTime}`,
        } as const,
      ],
    }
  }

  // Send transaction
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
    console.log("Transaction Receipt:", receipt)
  } catch (e: any) {
    console.error("Transaction Error:", e)
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/tx_error.png?raw=true",
      buttons: [
        {
          action: "post",
          target: "/frames?state=true",
          label: "Try again",
        } as const,
      ],
    }
  }

  // Insert claim into Supabase
  const { error: supabaseError } = await supabase.from("fox_claims").insert([
    {
      fid: fid,
      eth_address: userAddress,
      claimed_at: new Date().toISOString(),
    }
  ])

  if (supabaseError) {
    console.error("Error inserting into Supabase:", supabaseError)
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
      buttons: [
        {
          action: "post",
          target: "/frames?state=true",
          label: "Try again",
        } as const,
      ],
    }
  }

  console.log("Claim successfully saved to Supabase")

  return {
    image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claimed.png?raw=true",
    buttons: [
      {
        action: "link",
        target: `https://basescan.org/tx/${receipt}`,
        label: "See on Base Scan",
      } as const,
    ],
  }
})

export const GET = handleRequest
export const POST = handleRequest
