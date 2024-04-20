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
        <span>{walletAddress}</span>
      </div>
    ) : (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}
      >
        Get your coins!
        <span style={{fontSize: "24px"}}>You have to like first</span>
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
