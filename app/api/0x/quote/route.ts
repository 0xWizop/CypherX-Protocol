import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId") || "8453"; // Base
    const sellToken = searchParams.get("sellToken");
    const buyToken = searchParams.get("buyToken");
    const sellAmount = searchParams.get("sellAmount");
    const taker = searchParams.get("taker");
    const slippageBps = searchParams.get("slippageBps");

    if (!sellToken || !buyToken || !sellAmount || !taker) {
      return NextResponse.json({ error: "Missing required params" }, { status: 400 });
    }

    const apiKey = process.env.ZEROX_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "0x API key not configured" }, { status: 500 });
    }

    const url = new URL("https://api.0x.org/swap/allowance-holder/quote");
    url.searchParams.set("chainId", chainId);
    url.searchParams.set("sellToken", sellToken);
    url.searchParams.set("buyToken", buyToken);
    url.searchParams.set("sellAmount", sellAmount);
    url.searchParams.set("taker", taker);
    
    if (slippageBps) {
      url.searchParams.set("slippageBps", slippageBps);
    } else {
      url.searchParams.set("slippageBps", "100"); // Default 1%
    }

    // Affiliate fees
    const feeRecipient = process.env.ZEROX_FEE_RECIPIENT;
    const feeBps = process.env.ZEROX_FEE_BPS;
    if (feeRecipient && feeBps) {
      url.searchParams.set("integratorFeeRecipient", feeRecipient);
      url.searchParams.set("integratorFeeBps", feeBps);
    }

    console.log("🔍 0x Quote API Request:", {
      chainId,
      sellToken,
      buyToken,
      sellAmount,
      taker,
      slippageBps: slippageBps || "100"
    });

    const res = await fetch(url.toString(), {
      headers: {
        "0x-api-key": apiKey,
        "0x-version": "v2",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ 0x Quote API Error:", {
        status: res.status,
        error: data
      });
      return NextResponse.json(
        { 
          error: data?.reason || data?.validationErrors?.[0]?.description || "Failed to get quote",
          code: data?.code,
          details: data
        },
        { status: res.status }
      );
    }

    console.log("✅ 0x Quote API Success:", {
      buyAmount: data?.buyAmount,
      sellAmount: data?.sellAmount,
      allowanceNeeded: !!data?.issues?.allowance,
      balanceNeeded: !!data?.issues?.balance
    });

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    console.error("❌ 0x Quote API Exception:", e);
    return NextResponse.json(
      { error: e?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
