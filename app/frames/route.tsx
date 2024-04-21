import { supabase } from "@/lib/supabase"
import { checkInteractionTime } from "@/lib/utils"
import { chain, publicClient, walletClient } from "@/lib/web3-client"
import { farcasterHubContext } from "frames.js/middleware"
import { Button, createFrames } from "frames.js/next"
import { CSSProperties } from "react"
import { formatEther, parseEther } from "viem"

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
  const wallet = walletClient.account.address

  const balance = await publicClient.getBalance({
    address: wallet,
  })
  const balanceAsEther = formatEther(balance)

  // If no message, show home page
  if (!message)
    return {
      image: (
        <div style={div_style}>
          Claim your coins!
          <span style={{ fontSize: "24px" }}>
            You have to like the cast and follow the caster first
          </span>
          <span style={{ marginTop: "32px", fontSize: "24px" }}>
            Faucet balance: {balanceAsEther}
          </span>
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Claim
        </Button>,
      ],
    }

  // If user didn't complete the requirements, show to do list
  if (
    !message.likedCast ||
    !message.recastedCast ||
    !message.requesterFollowsCaster
  ) {
    return {
      image: (
        <div style={div_style}>
          <span>@todo list</span>
          <span>[ {message.likedCast ? "x" : " "} ] Like</span>
          <span>[ {message.recastedCast ? "x" : " "} ] Recast</span>
          <span>[ {message.requesterFollowsCaster ? "x" : " "} ] Follow</span>
        </div>
      ),
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
    .from("users")
    .select("created_at", { count: "exact" })
    .eq("fid", message?.requesterFid)
    .order("created_at", { ascending: false })
    .limit(1)
  const lastInteractionTime = checkInteractionTime(data)

  // If find claims or has not passed 24 hours since last claim
  if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
    return {
      image: (
        <div style={div_style}>
          <span>GM, {message.requesterUserData?.displayName}!</span>
          <span>wait {lastInteractionTime.formattedTime}</span>
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }

  // send transaction
  await walletClient.sendTransaction({
    to: message.requesterVerifiedAddresses[0] as `0x${string}`,
    value: parseEther("0.000333"),
  })

  // Save claim history
  await supabase.from("users").insert({
    fid: message?.requesterFid,
    f_address: message?.requesterCustodyAddress,
    eth_address: message?.requesterVerifiedAddresses[0],
  })

  return {
    image: (
      <div style={div_style}>
        ** you received 0.000333 eth on {chain.name} **
      </div>
    ),
  }
})

export const GET = handleRequest
export const POST = handleRequest
