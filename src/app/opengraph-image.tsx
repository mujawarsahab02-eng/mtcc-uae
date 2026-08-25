import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt = "Maharashtra Tennis Cricket Championship UAE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logoBuffer = await readFile(join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(160deg, #16213D 0%, #0A0F1C 55%, #05070d 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 8,
            background: "linear-gradient(90deg, transparent, #D4AF37 20%, #FF7A3D 50%, #D4AF37 80%, transparent)",
          }}
        />
        <div
          style={{
            display: "flex",
            width: 170,
            height: 170,
            borderRadius: 85,
            overflow: "hidden",
            border: "5px solid #D4AF37",
            marginBottom: 36,
            background: "#0A0F1C",
          }}
        >
          <img src={logoSrc} width={170} height={170} style={{ objectFit: "cover" }} />
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 8,
            color: "#FF7A3D",
            fontWeight: 700,
            marginBottom: 24,
            textTransform: "uppercase",
          }}
        >
          SEASON 1 · UAE · AUCTION-BASED
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 58,
            fontWeight: 900,
            color: "#FFFFFF",
            textAlign: "center",
            maxWidth: 940,
            lineHeight: 1.15,
            marginBottom: 28,
          }}
        >
          Maharashtra Tennis Cricket Championship UAE
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 600,
            color: "#F0C94A",
          }}
        >
          One Maharashtra. One Passion. One Championship.
        </div>
      </div>
    ),
    { ...size }
  );
}
