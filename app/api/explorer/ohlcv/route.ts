import { NextResponse } from "next/server";

// Proxy OHLCV fetch to avoid CORS and centralize fallbacks
// GET /api/explorer/ohlcv?pool=0x...&tf=1m|5m|15m|1h|4h|1d|1w
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = searchParams.get("pool");
    const tf = searchParams.get("tf") || "1h";
    if (!pool) {
      return NextResponse.json({ error: "Missing pool" }, { status: 400 });
    }

    const map: Record<string, { path: string; agg: string }> = {
      "1m": { path: "minute", agg: "1" },
      "5m": { path: "minute", agg: "5" },
      "15m": { path: "minute", agg: "15" },
      "1h": { path: "hour", agg: "1" },
      "4h": { path: "hour", agg: "4" },
      "1d": { path: "day", agg: "1" },
      "1w": { path: "day", agg: "7" },
    };
    const sel = map[tf] || map["1h"];

    // GeckoTerminal OHLCV
    const gtUrl = `https://api.geckoterminal.com/api/v2/networks/base/pools/${pool}/ohlcv/${sel.path}?aggregate=${sel.agg}&limit=500`;
    const res = await fetch(gtUrl, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const list: Array<[number, number, number, number, number]> = data?.data?.attributes?.ohlcv_list || [];
      const candles = list.map(([ts, open, high, low, close]) => ({
        time: Math.floor(Number(ts)),
        open,
        high,
        low,
        close,
      }));
      return NextResponse.json({ candles });
    }

    return NextResponse.json({ candles: [] }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ candles: [] }, { status: 200 });
  }
}



















