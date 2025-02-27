import { ABI } from "@/lib/abi"
import { FOX_CONTRACT } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import { checkInteractionTime } from "@/lib/utils"
import { account, publicClient, walletClient } from "@/lib/web3-client"
import { Button, createFrames } from "frames.js/next"
import { CSSProperties } from "react"
import { parseUnits } from "viem"

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

const handleRequest = frames(async (ctx) => {
  if (!ctx.req.body || !ctx.req.body.message) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claim.gif?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          🦊 Claim Fox
        </Button>,
      ],
    }
  }

  const message = ctx.req.body.message

  if (!Array.isArray(message.requesterVerifiedAddresses) || message.requesterVerifiedAddresses.length === 0) {
    return {
      image: (
        <div style={div_style}>
          You don't have a Verified Address added to Farcaster
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }

  // Get the user's wallet address from Farcaster
  const userAddress = message.requesterVerifiedAddresses[0] as `0x${string}`
  if (!userAddress) {
    return {
      image: (
        <div style={div_style}>
          Error: Unable to retrieve a verified address.
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }

  // Fetch last claim record
  const { data, error } = await supabase
    .from("fox_claims")
    .select("claimed_at", { count: "exact" })
    .eq("fid", message?.requesterFid)
    .order("claimed_at", { ascending: false })
    .limit(1)

  if (error) {
    return {
      image: (
        <div style={div_style}>
          Error fetching claim history.
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }

  const lastInteractionTime = checkInteractionTime(data)

  // If claim cooldown period is active
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
  } catch (e: any) {
    return {
      image: (
        <div style={{ ...div_style, textAlign: "center", padding: "0px 120px" }}>
          <span>Transaction error:</span>
          <span>{e.message}</span>
        </div>
      ),
    }
  }

  // Insert claim into Supabase
  const { error: supabaseError } = await supabase.from("fox_claims").insert([
    {
      fid: message?.requesterFid,
      f_address: message?.requesterCustodyAddress || null,
      eth_address: userAddress,
      claimed_at: new Date().toISOString(),
    }
  ])

  if (supabaseError) {
    return {
      image: (
        <div style={div_style}>
          Error saving claim to database.
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }

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
