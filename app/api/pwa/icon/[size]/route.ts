import React from "react";
import { ImageResponse } from "next/og";

const supportedSizes = new Set([180, 192, 512]);

export const dynamic = "force-static";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const requested = Number((await params).size);
  if (!supportedSizes.has(requested)) {
    return new Response("Unsupported icon size", { status: 404 });
  }

  const maskable = new URL(request.url).searchParams.get("maskable") === "1";
  const inset = maskable ? Math.round(requested * 0.14) : Math.round(requested * 0.08);
  const markSize = requested - inset * 2;

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#11120f",
          padding: inset,
          boxSizing: "border-box",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            width: markSize,
            height: markSize,
            borderRadius: Math.round(markSize * 0.24),
            background: "#ff6b0a",
            color: "#11120f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(markSize * 0.55),
            fontWeight: 900,
            letterSpacing: "-0.08em",
          },
        },
        "R",
      ),
    ),
    {
      width: requested,
      height: requested,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
