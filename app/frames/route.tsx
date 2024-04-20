import { supabase } from "@/lib/supabase"
import { checkInteractionTime } from "@/lib/utils"
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
  const message = ctx.message

  // If no message, show home page
  if (!message)
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

  // If user didn't complete the requirements, show to do list
  if (
    !message.likedCast ||
    !message.recastedCast ||
    !message.requesterFollowsCaster
  ) {
    return {
      image: (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
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

  // Find user last claim
  const { data, error } = await supabase
    .from("users")
    .select("created_at", { count: "exact" })
    .eq("fid", message?.requesterFid)
    .limit(1)

  let teste: any
  // If didn't find claims, send crypto and add claim log
  if (!data || !data.length) {
    teste = await supabase.from("users").insert({
      fid: message?.requesterFid,
      f_address: message?.requesterCustodyAddress,
      eth_address: message?.requesterVerifiedAddresses[0],
    })

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
  // If has passed 24 hours since last claim, send crypto and add claim log
  if (lastInteractionTime.has24HoursPassed) {
    teste = await supabase.from("users").insert({
      fid: message?.requesterFid,
      f_address: message?.requesterCustodyAddress,
      eth_address: message?.requesterVerifiedAddresses[0],
    })
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

  // Default
  return {
    image: message ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <span>GM, {message.requesterUserData?.displayName}!</span>
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
          You have to like and recast the cast, and follow the caster first
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
