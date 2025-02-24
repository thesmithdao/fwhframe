import { ABI } from "@/lib/abi";
import { FWH_CONTRACT } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { checkInteractionTime } from "@/lib/utils";
import { account, publicClient, walletClient } from "@/lib/web3-client";
import { Button, createFrames } from "frames.js/next";
import { CSSProperties } from "react";
import { parseUnits } from "viem";

const frames = createFrames({
  basePath: "/frames",
});

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
};

const handleRequest = frames(async (ctx) => {
  const message = ctx.message as any;

  if (!message)
    return {
      image:
        "https://github.com/thesmithdao/fwhframe/blob/main/public/claim.png?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          🦊 Claim FWH
        </Button>,
      ],
    };

  if (!message.requesterVerifiedAddresses || !message.requesterVerifiedAddresses.length) {
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
    };
  }

  const userAddress: `0x${string}` = message.requesterVerifiedAddresses[0] as `0x${string}`;

  if (!userAddress) {
    return {
      image: (
        <div style={div_style}>
          You don't have a Verified Address added to Farcaster.
        </div>
      ),
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    };
  }

  // Find user last claim
  const { data } = await supabase
    .from("fwh_claims")
    .select("claimed_at")
    .eq("eth_address", userAddress)
    .order("claimed_at", { ascending: false })
    .limit(1);

  const lastInteractionTime = checkInteractionTime(data);

  if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
    return {
      image:
        "https://github.com/thesmithdao/fwhframe/blob/main/public/wait.png?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          {`Try again in ${lastInteractionTime.formattedTime}`}
        </Button>,
      ],
    };
  }

  // send transaction
  let receipt = "";
  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: FWH_CONTRACT,
      abi: ABI,
      functionName: "transfer",
      args: [userAddress, parseUnits("0.000333", 18)],
    });
    receipt = await walletClient.writeContract(request);
  } catch (e: any) {
    return {
      image: (
        <div
          style={{ ...div_style, textAlign: "center", padding: "0px 120px" }}
        >
          <span>error:</span>
          <span>{e.message}</span>
        </div>
      ),
    };
  }

  // Save claim history
  await supabase.from("fwh_claims").insert({
    fid: message?.requesterFid || 0,
    f_address: message?.requesterVerifiedAddresses?.[0] || "N/A",
    eth_address: userAddress,
    claimed_at: new Date().toISOString(),
  });

  return {
    image:
      "https://github.com/thesmithdao/fwhframe/blob/main/public/claimed.png?raw=true",
    buttons: [
      <Button action="link" target={`https://basescan.org/tx/${receipt}`}>
        See on Base Scan
      </Button>,
    ],
  };
});

export const GET = handleRequest;
export const POST = handleRequest;
