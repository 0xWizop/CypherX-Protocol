import { NextResponse } from "next/server";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Fetch top volume pairs on Base from Dexscreener
// We use the network pools endpoint and sort by 24h volume
export async function GET() {
  try {
    // 1) Load supported tokens from our Firebase 'tokens' collection
    const tokensSnap = await getDocs(query(collection(db, "tokens")));
    const tokenAddresses: Array<{ address: string; symbol?: string; pool?: string }> = tokensSnap.docs
      .map((d) => ({ address: (d.data() as any).address, symbol: (d.data() as any).symbol, pool: (d.data() as any).pool }))
      .filter((t) => typeof t.address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(t.address));

    if (tokenAddresses.length === 0) {
      return NextResponse.json({ pairs: [] });
    }

    // 2) For each token address, fetch Dexscreener token data and pick the Base pair with highest 24h volume
    const chunkSize = 10;
    const results: any[] = [];

    for (let i = 0; i < tokenAddresses.length; i += chunkSize) {
      const chunk = tokenAddresses.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(async (t) => {
          try {
            const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${t.address}`, { cache: "no-store" });
            if (!resp.ok) return null;
            const data = await resp.json();
            const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
            if (!pairs.length) return null;
            // Filter to Base and sort by 24h volume desc
            const basePairs = pairs.filter((p: any) => (p?.chainId === 'base' || /base/i.test(p?.chainId || '')));
            if (basePairs.length === 0) return null;
            const top = basePairs.sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0];
            return {
              poolAddress: top.pairAddress,
              baseSymbol: top.baseToken?.symbol || t.symbol,
              baseAddress: top.baseToken?.address || t.address,
              quoteSymbol: top.quoteToken?.symbol,
              priceUsd: parseFloat(top.priceUsd || "0"),
              volume24h: top.volume?.h24 || 0,
              txns24h: top.txns?.h24 ? (top.txns.h24.buys + top.txns.h24.sells) : 0,
              priceChange24h: top.priceChange?.h24 ?? 0,
              imageUrl: top.info?.imageUrl || null,
            };
          } catch {
            return null;
          }
        })
      );
      results.push(...chunkResults.filter(Boolean));
    }

    // 3) Rank across our supported tokens by 24h volume and return top 10
    const top10 = results
      .filter((r) => r && typeof r.volume24h === 'number')
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10);

    return NextResponse.json({ pairs: top10 });
  } catch (e) {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}


