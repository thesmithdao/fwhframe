import { ABI } from "@/lib/abi";
import { FOX_CONTRACT } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { checkInteractionTime } from "@/lib/utils";
import { account, publicClient, walletClient } from "@/lib/web3-client";
import { FrameButton, FrameButtonLink } from "frames.js";
import { farcasterHubContext } from "frames.js/middleware";
import { createFrames } from "frames.js/next";
import { parseUnits } from "viem";

// Ensure the WARPCAST_API_KEY environment variable is set
const WARPCAST_API_KEY = process.env.WARPCAST_API_KEY;

if (!WARPCAST_API_KEY) {
  console.warn("[Env] WARPCAST_API_KEY is not defined");
}

const frames = createFrames({
  basePath: "/frames",
  middleware: [
    farcasterHubContext({
      ...(process.env.NODE_ENV === "production"
        ? {
            hubRequestOptions: {
              headers: {
                Authorization: `Bearer ${WARPCAST_API_KEY}`,
                "Content-Type": "application/json",
              },
            },
          }
        : {
            hubHttpUrl: "http://localhost:3010/hub",
          }),
    }),
  ],
});

// Fetch the user's verified Ethereum address from Farcaster API
const getVerifiedAddress = async (fid: number): Promise<`0x${string}` | null> => {
  if (!fid) {
    console.error("[Warpcast API] Invalid FID provided");
    return null;
  }

  try {
    console.log(`[Warpcast API] Fetching verified address for FID: ${fid}`);
    const response = await fetch(`https://api.warpcast.com/v2/verifications?fid=${fid}`, {
      headers: {
        Authorization: `Bearer ${WARPCAST_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[Warpcast API] Error response: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    // Check if we have verification data
    if (!data?.result?.verifications?.length) {
      console.warn(`[Warpcast API] No verifications found for FID: ${fid}`);
      return null;
    }

    // Find the first Ethereum address in verifications
    for (const verification of data.result.verifications) {
      // Make sure we're getting an address property
      let address = verification.address || verification.addressVerification || verification;
      
      if (typeof address === "string") {
        // Ensure address starts with 0x
        if (!address.startsWith("0x")) {
          address = `0x${address}`;
        }

        // Validate Ethereum address format
        if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
          console.log(`[Warpcast API] Verified Ethereum address: ${address}`);
          return address as `0x${string}`;
        }
      }
    }

    console.warn(`[Warpcast API] No valid Ethereum address found for FID: ${fid}`);
    return null;
  } catch (error) {
    console.error("[Warpcast API] Error fetching verified address:", error);
    return null;
  }
};

const handleRequest = frames(async (ctx) => {
  console.log("[Frames.js] Incoming request:", JSON.stringify(ctx, null, 2));

  // Default state if message is not present
  if (!ctx.message) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claim.gif?raw=true",
      buttons: [
        {
          action: "post",
          label: "🦊 Claim Fox",
        },
      ],
    };
  }

  const userAddress = await getVerifiedAddress(ctx.message.requesterFid);
  if (!userAddress) {
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/no_address.png?raw=true",
      buttons: [
        {
          action: "post",
          label: "Try again",
        },
      ],
    };
  }

  console.log(`[Frames.js] Verified address for FID ${ctx.message.requesterFid}: ${userAddress}`);

  // Check if user has already claimed within 24 hours
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
          {
            action: "post",
            label: "Try again",
          },
        ],
      };
    }

    const lastInteractionTime = checkInteractionTime(data);

    if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
      return {
        image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/wait.png?raw=true",
        buttons: [
          {
            action: "post",
            label: `Try again in ${lastInteractionTime.formattedTime}`,
          },
        ],
      };
    }
  } catch (dbError) {
    console.error("[Database] Error checking claim history:", dbError);
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/error.png?raw=true",
      buttons: [
        {
          action: "post",
          label: "Try again",
        },
      ],
    };
  }

  // Send FOX tokens
  let receipt = "";
  try {
    // Check if web3 clients are properly initialized
    if (!publicClient || !walletClient || !account) {
      throw new Error("Web3 clients not properly initialized");
    }

    // Prepare and send transaction
    const { request } = await publicClient.simulateContract({
      account,
      address: FOX_CONTRACT,
      abi: ABI,
      functionName: "transfer",
      args: [userAddress, parseUnits("0.000333", 18)],
    });
    
    receipt = await walletClient.writeContract(request);
    console.log(`[Blockchain] Transaction sent, receipt: ${receipt}`);
    
    // Save the claim to the database
    const save = await supabase.from("fox_claims").insert({
      fid: ctx.message.requesterFid,
      f_address: ctx.message.requesterCustodyAddress,
      eth_address: userAddress,
      claimed_at: new Date().toISOString(), // Explicitly set timestamp
      tx_hash: receipt,
    });

    if (save.error) {
      console.error("[Supabase] Error inserting claim:", save.error);
      // Continue to show success to user even if DB save fails
    } else {
      console.log(`[Supabase] Claim successfully saved for FID ${ctx.message.requesterFid}`);
    }

    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/claimed.png?raw=true",
      buttons: [
        {
          action: "link",
          target: `https://basescan.org/tx/${receipt}`,
          label: "See on Base Scan",
        },
      ],
    };
  } catch (e) {
    console.error("[Blockchain] Transaction failed:", e);
    return {
      image: "https://github.com/r4topunk/shapeshift-faucet-frame/blob/main/public/tx_error.png?raw=true",
      buttons: [
        {
          action: "post",
          label: "Try again",
        },
      ],
    };
  }
});

export const GET = handleRequest;
export const POST = handleRequest;
