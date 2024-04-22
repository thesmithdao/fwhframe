import { fetchMetadata } from "frames.js/next"
import { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Faucet Frame",
    other: {
      ...(await fetchMetadata(
        new URL(
          "/frames",
          process.env.FOX_WEBSITE_URL || "http://localhost:3000"
        )
      )),
    },
  }
}

export default async function Home() {
  return (
    <div
      style={{
        backgroundColor: "black",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "#00FF41",
        textShadow: "0 0 2px #00FF41,0 0 3px #00FF41,0 0 3px #00FF41",
        filter: "blur(0.02rem)",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <span style={{ fontSize: "24px" }}>Farcaster Faucet Frame</span>
      <a
        href="https://warpcast.com/r4topunk/0x12d169c7"
        style={{
          textDecoration: "none",
          color: "#00FF41",
          border: "2px solid #00FF41",
          padding: "4px 8px",
          boxShadow: "0 0 2px #00FF41,0 0 3px #00FF41,0 0 3px #00FF41",
          textShadow: "0 0 2px #00FF41,0 0 3px #00FF41,0 0 3px #00FF41",
          filter: "blur(0.02rem)",
          fontSize: "18px",
        }}
      >
        View Cast
      </a>
    </div>
  )
}
