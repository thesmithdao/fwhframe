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
  const message = ctx.message as any; // Ensure it recognizes properties

  if (!message)
    return {
      image: "https://github.com/thesmithdao/fwhframe/blob/main/public/claim.png?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          🦊 Claim FWH
        </Button>,
      ],
    };

  let image = "";

  if (!message?.likedCast && !message?.requesterFollowsCaster) {
    image = "https://github.com/thesmithdao/fwhframe/blob/main/public/fox_follow_like.png?raw=true";
  } else if (!message?.likedCast) {
    image = "https://github.com/thesmithdao/fwhframe/blob/main/public/fox_like.png?raw=true";
  } else {
    image = "https://github.com/thesmithdao/fwhframe/blob/main/public/fox_follow.png?raw=true";
  }

  if (!message?.likedCast || !message?.requesterFollowsCaster) {
    return {
      image: image,
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          Try again
        </Button>,
      ],
    };
  }

  if (!message?.requesterVerifiedAddresses?.length) {
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

  const userAddress = message?.requesterVerifiedAddresses?.[0] as `0x${string}`;

  // Find user last claim
  const { data } = await supabase
    .from("fwh_claims")
    .select("claimed_at")
    .eq("fid", message?.requesterFid)
    .order("claimed_at", { ascending: false })
    .limit(1);

  const lastInteractionTime = checkInteractionTime(data);

  if (lastInteractionTime && !lastInteractionTime.has24HoursPassed) {
    const buttonText = `Try again in ${lastInteractionTime.formattedTime}`;
    return {
      image: "https://github.com/thesmithdao/fwhframe/blob/main/public/wait.png?raw=true",
      buttons: [
        <Button action="post" target={{ query: { state: true } }}>
          {buttonText}
        </Button>,
      ],
    };
  }

  const { request } = await publicClient.simulateContract({
    account,
    address: FWH_CONTRACT,
    abi: ABI,
    functionName: "transfer",
    args: [userAddress, parseUnits("0.000333", 18)],
  });

  const receipt = await walletClient.writeContract(request);

  await supabase.from("fwh_claims").insert({
    fid: message?.requesterFid,
    f_address: message?.requesterCustodyAddress || userAddress, // Ensure it's not null
    eth_address: userAddress,
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
