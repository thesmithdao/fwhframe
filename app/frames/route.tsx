import { supabase } from "@/lib/supabase"
import { checkInteractionTime } from "@/lib/utils"
import { client } from "@/lib/web3-client"
import { farcasterHubContext } from "frames.js/middleware"
import { Button, createFrames } from "frames.js/next"

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

const handleRequest = frames(async (ctx) => {
  const walletAddress = client.account.address

  if (!ctx.message)
    return {
      image: (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          Get your coins!
          <span style={{ fontSize: "24px" }}>
            You have to like the cast and follow the caster first
          </span>
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          GET
        </Button>,
      ],
    }

  if (!ctx.message.likedCast || !ctx.message.recastedCast) {
    return {
      image: (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span>You have to like the cast and follow the caster first</span>
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          GET
        </Button>,
      ],
    }
  }

  console.log({
    fid: ctx.message?.requesterFid,
    f_address: ctx.message?.requesterCustodyAddress,
    eth_address: ctx.message?.requesterVerifiedAddresses[0],
  })

  const { data, error } = await supabase
    .from("users")
    .select("created_at", { count: "exact" })
    .eq("fid", ctx.message?.requesterFid)
    .limit(1)
  console.log({ data, error })

  let teste: any
  if (!data || !data.length) {
    teste = await supabase.from("users").insert({
      fid: ctx.message?.requesterFid,
      f_address: ctx.message?.requesterCustodyAddress,
      eth_address: ctx.message?.requesterVerifiedAddresses[0],
    })

    console.log({ teste })
    return {
      image: (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          ** coins **
        </div>
      ),
    }
  }

  const lastInteractionTime = checkInteractionTime(data[0].created_at)
  if (lastInteractionTime.has24HoursPassed) {
    return {
      image: (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          ** coins **
        </div>
      ),
    }
  }

  return {
    image: ctx.message ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <span>GM, {ctx.message.requesterUserData?.displayName}!</span>
        <span>wait {lastInteractionTime.formattedTime}</span>
      </div>
    ) : (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        Get your coins!
        <span style={{ fontSize: "24px" }}>
          You have to like the cast and follow the caster first
        </span>
      </div>
    ),
    buttons: !ctx.url.searchParams.has("state")
      ? [
          <Button action="post" target={{ query: { state: true } }}>
            GET
          </Button>,
        ]
      : [],
  }
})

export const GET = handleRequest
export const POST = handleRequest
