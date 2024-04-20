import { publicClient } from "@/lib/web3-client"
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
  const blockNumber = await publicClient.getBlockNumber()

  return {
    image: ctx.message ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}
      >
        <span>GM, {ctx.message.requesterUserData?.displayName}!</span><br/>
        <span>Your FID is {ctx.message.requesterFid}</span><br/>
        <span>LET'S HACK THE PLAN3T</span><br/>
        <span>You're on ETH {" " + blockNumber}'st block</span>
      </div>
    ) : (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        Say GM
      </div>
    ),
    buttons: !ctx.url.searchParams.has("state")
      ? [
          <Button action="post" target={{ query: { state: true } }}>
            Say GM
          </Button>,
        ]
      : [],
  }
})

export const GET = handleRequest
export const POST = handleRequest
