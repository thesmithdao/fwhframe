import { ABI } from "@/lib/abi"
import { FOX_CONTRACT } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import { checkInteractionTime } from "@/lib/utils"
import { account, publicClient, walletClient } from "@/lib/web3-client"
import { Button, createFrames } from "frames.js/next"
import { CSSProperties } from "react"
import { parseUnits } from "viem"

const WARPCAST_API_KEY = process.env.WARPCAST_API_KEY

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

const getVerifiedAddress = async (fid: number) => {
  try {
    const response = await fetch(`https://api.warpcast.com/v2/verifications?fid=${fid}`, {
      headers: {
        Authorization: `Bearer ${WARPCAST_API_KEY}`,
        "Content-Type": "application/json",
      },
    })
    const data = await response.json()
    return data?.result?.verifications?.[0] || null
  } catch (error) {
    console.error("Error fetching Farcaster address:", error)
    return null
  }
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

  // Extract FID from Farcaster request
  const fid = ctx.message?.requesterFid
  if (!fid) {
    return {
      image: (
        <div style={div_style}>
          Error: Missing Farcaster FID.
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try a
