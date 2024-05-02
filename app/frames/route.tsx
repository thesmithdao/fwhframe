import { ABI } from "@/lib/abi"
import { FOX_CONTRACT } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import { checkInteractionTime } from "@/lib/utils"
import { account, publicClient, walletClient } from "@/lib/web3-client"
import { farcasterHubContext } from "frames.js/middleware"
import { Button, createFrames } from "frames.js/next"
import { CSSProperties } from "react"
import { parseUnits } from "viem"

const frames = createFrames({
  basePath: "/frames",
  middleware: [
    farcasterHubContext({
      // remove if you aren't using @frames.js/debugger or you just don't want to use the debugger hub
      ...(process.env.NODE_ENV === "production"
        ? {}
        : {
            hubHttpUrl: "http://localhost:3010/hub",
          }),
    }),
  ],
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
  const message = ctx.message

  // If no message, show home page
  if (!message)
    return {
      image:
        "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claim.gif?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          🦊 Claim Fox
        </Button>,
      ],
    }

  let image = ""

  if (!message.likedCast && !message.requesterFollowsCaster) {
    image = "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/fox_follow_like.png?raw=true"
  } else if (!message.likedCast) {
    image = "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/fox_follow.png?raw=true"
  } else {
    image = "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/fox_like.png?raw=true"
  }

  // If user didn't complete the requirements, show to do list
  if (!message.likedCast || !message.requesterFollowsCaster) {
    return {
      image: image,
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }

  if (!message.requesterVerifiedAddresses.length) {
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

  // Find user last claim
  const { data, error } = await supabase
    .from("fox_claims")
    .select("claimed_at", { count: "exact" })
    .eq("fid", message?.requesterFid)
    .order("claimed_at", { ascending: false })
    .limit(1)
  const lastInteractionTime = checkInteractionTime(data)

  // If find claims or has not passed 24 hours since last claim
  if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
    const buttonText = `Try again in ${lastInteractionTime.formattedTime}`
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/wait.png?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          {buttonText}
        </Button>,
      ],
    }
  }

  const userAddress = message.requesterVerifiedAddresses[0] as `0x${string}`

  // send transaction
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
    console.error(e)
    return {
      image: (
        <div
          style={{ ...div_style, textAlign: "center", padding: "0px 120px" }}
        >
          <span>error:</span>
          <span>{e.message}</span>
        </div>
      ),
    }
  }

  // Save claim history
  const save = await supabase.from("fox_claims").insert({
    fid: message?.requesterFid,
    f_address: message?.requesterCustodyAddress,
    eth_address: userAddress,
  })

  return {
    image:
      "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claimed.png?raw=true",
    buttons: [
      <Button
        action="link"
        target={`https://optimistic.etherscan.io/tx/${receipt}`}
      >
        See on OP Scan
      </Button>,
    ],
  }
})

export const GET = handleRequest
export const POST = handleRequest
