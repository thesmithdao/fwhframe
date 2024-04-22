import { ABI } from "@/lib/abi"
import { FOX_CONTRACT } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import { checkInteractionTime } from "@/lib/utils"
import { account, chain, publicClient, walletClient } from "@/lib/web3-client"
import { farcasterHubContext } from "frames.js/middleware"
import { Button, createFrames } from "frames.js/next"
import { CSSProperties } from "react"
import { formatEther, formatUnits, parseUnits } from "viem"

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

  const foxBalance = await publicClient.readContract({
    address: FOX_CONTRACT,
    abi: ABI,
    functionName: "balanceOf",
    args: [wallet],
  })

  // If no message, show home page
  if (!message)
    return {
      image: (
        <div style={div_style}>
          Claim tokens!
          <span style={{ fontSize: "24px" }}>
            You have to like the cast and follow the caster first
          </span>
          <div
            style={{
              marginTop: "32px",
              fontSize: "24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span>Faucet balance:</span>
            <span>{balanceAsEther} ETH</span>
            <span>{formatUnits(foxBalance, 18)} FOX</span>
          </div>
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          🦊 Claim Fox
        </Button>,
      ],
    }

  // If user didn't complete the requirements, show to do list
  if (!message.likedCast || !message.requesterFollowsCaster) {
    return {
      image: (
        <div style={div_style}>
          <span>@todo list</span>
          <span>[ {message.likedCast ? "x" : " "} ] Like</span>
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
    .from("fox_claims")
    .select("claimed_at", { count: "exact" })
    .eq("fid", message?.requesterFid)
    .order("claimed_at", { ascending: false })
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
    image: (
      <div style={div_style}>
        ** you received 0.000333 FOX on {chain.name} **
      </div>
    ),
    buttons: [
      <Button
        action="link"
        target={`https://optimistic.etherscan.io/tx/${receipt}`}
      >
        See on Optimism Scan
      </Button>,
    ],
  }
})

export const GET = handleRequest
export const POST = handleRequest
