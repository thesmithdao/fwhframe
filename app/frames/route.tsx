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
  const lastInteractionTime = checkInteractionTime(data)

  // If find claims or has not passed 24 hours since last claim
  if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
    return {
      image: (
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
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    }
  }

  // @todo send crypto

  // Save claim history
  const teste = await supabase.from("users").insert({
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
        ** crypto **
      </div>
    ),
  }
})

export const GET = handleRequest
export const POST = handleRequest
