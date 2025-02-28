import { ABI } from "@/lib/abi";
import { FOX_CONTRACT } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { checkInteractionTime } from "@/lib/utils";
import { account, publicClient, walletClient } from "@/lib/web3-client";
import { createFrames } from "frames.js/next";
import { parseUnits } from "viem";

// Ensure the WARPCAST_API_KEY environment variable is set
const WARPCAST_API_KEY = process.env.WARPCAST_API_KEY;

if (!WARPCAST_API_KEY) {
  console.warn("[Env] WARPCAST_API_KEY is not defined");
}

const frames = createFrames({
  basePath: "/frames",
});

const handleRequest = frames(async (ctx) => {
  console.log("[Frames.js] Incoming request:", JSON.stringify(ctx, null, 2));

  if (!ctx.message) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claim.gif?raw=true",
      buttons: [
        { action: "post", target: { query: { state: "true" } }, label: "🦊 Claim Fox" },
      ],
    };
  }

  const userAddress = ctx.message.requesterVerifiedAddresses[0] as `0x${string}`;
  if (!userAddress) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/no_address.png?raw=true",
      buttons: [
        { action: "post", target: { query: { state: "true" } }, label: "Try again" },
      ],
    };
  }

  console.log(`[Frames.js] Verified address for FID ${ctx.message.requesterFid}: ${userAddress}`);

  try {
    const { data, error } = await supabase
      .from("fox_claims")
      .select("claimed_at", { count: "exact" })
      .eq("fid", ctx.message.requesterFid)
      .order("claimed_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[Supabase] Error fetching claim history:", error);
      return {
        image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
        buttons: [
          { action: "post", target: { query: { state: "true" } }, label: "Try again" },
        ],
      };
    }

    const lastInteractionTime = checkInteractionTime(data);
    if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
      return {
        image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/wait.png?raw=true",
        buttons: [
          { action: "post", target: { query: { state: "true" } }, label: `Try again in ${lastInteractionTime.formattedTime}` },
        ],
      };
    }
  } catch (dbError) {
    console.error("[Database] Error checking claim history:", dbError);
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
      buttons: [
        { action: "post", target: { query: { state: "true" } }, label: "Try again" },
      ],
    };
  }

  // Send FOX tokens
  let receipt = "";
  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: FOX_CONTRACT,
      abi: ABI,
      functionName: "transfer",
      args: [userAddress, parseUnits("0.000333", 18)],
    });

    receipt = await walletClient.writeContract(request);
    console.log(`[Blockchain] Transaction sent, receipt: ${receipt}`);

    await supabase.from("fox_claims").insert({
      fid: ctx.message.requesterFid,
      f_address: ctx.message.requesterCustodyAddress,
      eth_address: userAddress,
      claimed_at: new Date().toISOString(),
      tx_hash: receipt,
    });

    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claimed.png?raw=true",
      buttons: [
        { action: "link", target: `https://basescan.org/tx/${receipt}`, label: "See on Base Scan" },
      ],
    };
  } catch (e) {
    console.error("[Blockchain] Transaction failed:", e);
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/tx_error.png?raw=true",
      buttons: [
        { action: "post", target: { query: { state: "true" } }, label: "Try again" },
      ],
    };
  }
});

export const GET = handleRequest;
export const POST = handleRequest;
