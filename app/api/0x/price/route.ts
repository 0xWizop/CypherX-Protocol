import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId") || "8453"; // Base
    const sellToken = searchParams.get("sellToken");
    const buyToken = searchParams.get("buyToken");
    const sellAmount = searchParams.get("sellAmount");
    const taker = searchParams.get("taker") || undefined;
    const slippageBps = searchParams.get("slippageBps") || undefined;

    if (!sellToken || !buyToken || !sellAmount) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    // Validate API key
    const apiKey = process.env.ZEROX_API_KEY;
    if (!apiKey) {
      console.warn("⚠️  ZEROX_API_KEY not set - using demo key or may fail");
    }

    const url = new URL("https://api.0x.org/swap/allowance-holder/price");
    url.searchParams.set("chainId", chainId);
    url.searchParams.set("sellToken", sellToken);
    url.searchParams.set("buyToken", buyToken);
    url.searchParams.set("sellAmount", sellAmount);
    if (taker) url.searchParams.set("taker", taker);
    if (slippageBps) {
      url.searchParams.set("slippageBps", slippageBps);
    } else {
      // Default slippage tolerance (1% = 100 bps)
      url.searchParams.set("slippageBps", "100");
    }

    // Affiliate fees (monetization)
    const feeRecipient = process.env.ZEROX_FEE_RECIPIENT;
    const feeBps = process.env.ZEROX_FEE_BPS; // e.g., "30" for 0.30%
    if (feeRecipient && feeBps) {
      url.searchParams.set("integratorFeeRecipient", feeRecipient);
      url.searchParams.set("integratorFeeBps", feeBps);
    }

    console.log("🔍 0x Price API Request:", {
      url: url.toString(),
      chainId,
      sellToken,
      buyToken,
      sellAmount,
      hasApiKey: !!apiKey
    });

    const res = await fetch(url.toString(), {
      headers: {
        "0x-api-key": apiKey || "",
        "0x-version": "v2",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ 0x Price API Error:", {
        status: res.status,
        statusText: res.statusText,
        error: data
      });
      return NextResponse.json(
        { 
          error: data?.reason || data?.validationErrors?.[0]?.description || "Failed to get price",
          code: data?.code,
          details: data
        },
        { status: res.status }
      );
    }

    // 0x API returns: { buyAmount: string, sellAmount: string, ... }
    console.log("✅ 0x Price API Success:", {
      buyAmount: data?.buyAmount,
      sellAmount: data?.sellAmount,
      estimatedGas: data?.estimatedGas
    });

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    console.error("❌ 0x Price API Exception:", e);
    return NextResponse.json(
      { error: e?.message || "Internal server error" },
      { status: 500 }
    );
  }
}


