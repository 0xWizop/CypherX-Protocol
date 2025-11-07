import { NextResponse } from "next/server";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Simple in-memory cache for this route to avoid Dexscreener rate limits
let cache: { data: any; ts: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60s

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithBackoff(url: string, init?: RequestInit, maxRetries = 3) {
  let attempt = 0;
  let delay = 500; // ms
  while (attempt < maxRetries) {
    const res = await fetch(url, { cache: "no-store", ...init });
    if (res.status !== 429 && res.ok) return res;
    attempt += 1;
    if (attempt >= maxRetries) return res;
    const retryAfter = Number(res.headers.get("retry-after")) || 0;
    const wait = Math.max(retryAfter * 1000, delay);
    await sleep(wait);
    delay *= 2; // exponential backoff
  }
  // Fallback return (should never reach here, but TypeScript needs it)
  return new Response(null, { status: 500 });
}

// Fetch top volume pairs on Base from Dexscreener
// We use the network pools endpoint and sort by 24h volume
export async function GET() {
  try {
    // Serve from cache if fresh
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      return NextResponse.json(cache.data, { headers: { 'Cache-Control': 'private, max-age=30' } });
    }
    // 1) Load supported tokens from our Firebase 'tokens' collection
    const tokensSnap = await getDocs(query(collection(db, "tokens")));
    const tokenAddresses: Array<{ address: string; symbol?: string; pool?: string }> = tokensSnap.docs
      .map((d) => ({ address: (d.data() as any).address, symbol: (d.data() as any).symbol, pool: (d.data() as any).pool }))
      .filter((t) => typeof t.address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(t.address));

    if (tokenAddresses.length === 0) {
      return NextResponse.json({ pairs: [] });
    }

    // 2) Batch fetch Dexscreener data using multi-token endpoint in chunks
    const results: any[] = [];
    const batchSize = 20; // conservative chunk size to avoid rate limits
    for (let i = 0; i < tokenAddresses.length; i += batchSize) {
      const chunk = tokenAddresses.slice(i, i + batchSize);
      const addrs = chunk.map((t) => t.address).join(',');
      const url = `https://api.dexscreener.com/latest/dex/tokens/${addrs}`;
      const resp = await fetchWithBackoff(url, undefined, 4);
      if (!resp || !resp.ok) {
        // fallback: skip this chunk
        continue;
      }
      const data = await resp.json();
      const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
      if (!pairs.length) continue;

      // Group by base token address (only for tokens in our list), pick top Base pair by 24h volume
      const wanted = new Set(chunk.map((t) => t.address.toLowerCase()));
      const bestByToken: Record<string, any> = {};
      for (const p of pairs) {
        const baseAddr = p?.baseToken?.address?.toLowerCase();
        if (!baseAddr || !wanted.has(baseAddr)) continue;
        const isBaseChain = p?.chainId === 'base' || /base/i.test(p?.chainId || '');
        if (!isBaseChain) continue;
        const curr = bestByToken[baseAddr];
        if (!curr || (p?.volume?.h24 || 0) > (curr?.volume?.h24 || 0)) {
          bestByToken[baseAddr] = p;
        }
      }
      for (const t of chunk) {
        const top = bestByToken[t.address.toLowerCase()];
        if (!top) continue;
        results.push({
          poolAddress: top.pairAddress,
          baseSymbol: top.baseToken?.symbol || t.symbol,
          baseAddress: top.baseToken?.address || t.address,
          quoteSymbol: top.quoteToken?.symbol,
          priceUsd: parseFloat(top.priceUsd || "0"),
          volume24h: top.volume?.h24 || 0,
          txns24h: top.txns?.h24 ? (top.txns.h24.buys + top.txns.h24.sells) : 0,
          priceChange24h: top.priceChange?.h24 ?? 0,
          imageUrl: top.info?.imageUrl || null,
        });
      }
      // brief pause between batches
      await sleep(150);
    }

    // 3) Rank across our supported tokens by 24h volume and return top 10
    const top10 = results
      .filter((r) => r && typeof r.volume24h === 'number')
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10);

    const payload = { pairs: top10 };
    cache = { data: payload, ts: Date.now() };
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=30' } });
  } catch (e) {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}


