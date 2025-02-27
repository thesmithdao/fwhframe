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

// Define types to avoid TypeScript errors
type FarcasterMessage = {
  requesterFid?: number
  requesterVerifiedAddresses?: string[]
  requesterCustodyAddress?: string
}

type RequestBody = {
  message?: FarcasterMessage
}

const handleRequest = frames(async (ctx) => {
  console.log("CTX OBJECT RECEIVED:", JSON.stringify(ctx, null, 2))

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

  // Manually parse JSON request body
  let requestBody: RequestBody = {}
  try {
    requestBody = (await ctx.request.json()) as RequestBody
  } catch (err) {
    console.error("Error parsing request body:", err)
  }

  console.log("Parsed Request Body:", JSON.stringify(requestBody, null, 2))

  // Extract `message` properly
  const message: FarcasterMessage | undefined =
    (ctx.input as RequestBody)?.message ||
    requestBody?.message ||
    (ctx.body as RequestBody)?.message

  if (!message) {
    console.error("Error: No message found in request")
    return {
      image: (
        <div style={div_style}>
          Error: No message found in request.
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }

  console.log("Extracted Message:", JSON.stringify(message, null, 2))

  if (!Array.isArray(message.requesterVerifiedAddresses) || message.requesterVerifiedAddresses.length === 0) {
    console.error("Error: No verified addresses found in message")
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

  // Retrieve and validate the claimer's address
  const userAddress = message.requesterVerifiedAddresses[0] as `0x${string}`
  if (!userAddress) {
    console.error("Error: Unable to retrieve a verified address")
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

  console.log("User Address Extracted:", userAddress)

  // Fetch last claim record
  const { data, error } = await supabase
    .from("fox_claims")
    .select("claimed_at", { count: "exact" })
    .eq("fid", message?.requesterFid)
    .order("claimed_at", { ascending: false })
    .limit(1)

  if (error) {
    console.error("Error fetching claim history:", error)
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

  console.log("Last Claim Data:", JSON.stringify(data, null, 2))

  const lastInteractionTime = checkInteractionTime(data)

  // If claim cooldown period is active
  if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
    console.log("Cooldown Active:", lastInteractionTime.formattedTime)
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
    console.log("Transaction Receipt:", receipt)
  } catch (e: any) {
    console.error("Transaction Error:", e)
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
    console.error("Error inserting into Supabase:", supabaseError)
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

  console.log("Claim successfully saved to Supabase")

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
