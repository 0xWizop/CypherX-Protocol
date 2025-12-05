// app/api/trending-widget/route.ts
import { NextResponse } from 'next/server';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type TokenData = {
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h1: number;
    h24: number;
  };
  marketCap?: number;
  liquidity: {
    usd: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
  };
  txns: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  trendingScore?: number;
  boosted?: boolean;
  boostValue?: number;
  weight?: number;
};

interface DexScreenerBaseToken {
  address: string;
  name: string;
  symbol: string;
}

interface DexScreenerQuoteToken {
  address: string;
  name: string;
  symbol: string;
}

interface DexScreenerPriceChange {
  m5?: number;
  h1?: number;
  h6?: number;
  h24?: number;
}

interface DexScreenerVolume {
  h1: number;
  h24: number;
}

interface DexScreenerLiquidity {
  usd: number;
}

interface DexScreenerTxns {
  h1: { buys: number; sells: number };
  h6: { buys: number; sells: number };
  h24: { buys: number; sells: number };
}

interface DexScreenerPair {
  baseToken: DexScreenerBaseToken;
  quoteToken: DexScreenerQuoteToken;
  priceUsd: string;
  priceChange?: DexScreenerPriceChange;
  volume?: DexScreenerVolume;
  marketCap?: number;
  liquidity?: DexScreenerLiquidity;
  fdv?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
  txns: DexScreenerTxns;
}

function computeTrending(token: TokenData, boostValue: number): number {
  const getTxns24h = (t: TokenData): number => {
    const tx = t.txns?.h24;
    return tx ? tx.buys + tx.sells : 0;
  };

  const DECAY_CONSTANT = 7;
  const txnsTotal = getTxns24h(token);
  let txnScore = Math.log10(txnsTotal + 1) * 1.5;
  if (txnsTotal < 10) txnScore *= 0.3;
  else if (txnsTotal < 50) txnScore *= 0.7;
  
  const volumeScore = Math.log10((token.volume?.h24 ?? 0) + 1) * 0.5;
  const liquidityScore = Math.log10(token.liquidity.usd + 1) * 0.3;

  const change1h = token.priceChange?.h1 ?? 0;
  const change6h = token.priceChange?.h6 ?? 0;
  const change24h = token.priceChange?.h24 ?? 0;

  const priceMovementScore =
    (change1h > 0 ? Math.log10(Math.abs(change1h) + 1) * 2 : 0) +
    (change6h > 0 ? Math.log10(Math.abs(change6h) + 1) * 2 : 0) +
    (change24h > 0 ? Math.log10(Math.abs(change24h) + 1) * 2 : 0);

  const consistencyBonus = (change1h > 0 && change6h > 0 && change24h > 0) ? 10 : 0;
  const volumeToMcap = token.marketCap ? (token.volume?.h24 ?? 0) / token.marketCap : 0;
  const volumeMcapScore = Math.log10(volumeToMcap + 1) * 2;
  const boostScore = boostValue;

  const ageDecay = token.pairCreatedAt
    ? Math.max(0.3, Math.exp(-(Date.now() - token.pairCreatedAt) / (1000*60*60*24) / DECAY_CONSTANT))
    : 0.5;

  const baseScore = txnScore + volumeScore + liquidityScore + priceMovementScore + consistencyBonus + volumeMcapScore + boostScore;
  return token.pairCreatedAt ? baseScore * ageDecay : baseScore * 0.8;
}

export async function GET() {
  try {
    // Fetch tokens from Firestore
    const tokensSnapshot = await getDocs(collection(db, 'tokens'));
    const tokenList = tokensSnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as DocumentData;
      return {
        pool: String(data.pool),
        symbol: String(data.symbol),
        address: String(data.address),
        name: typeof data.name === 'string' ? data.name : undefined,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().getTime()
          : 0,
        docId: docSnap.id,
      };
    });

    const validTokens = tokenList.filter((t) => /^0x[a-fA-F0-9]{40}$/.test(t.address));
    if (validTokens.length === 0) {
      return NextResponse.json({ error: 'No valid token addresses found' }, { status: 404 });
    }

    // Chunk addresses for DexScreener API
    const chunks: string[][] = [];
    for (let i = 0; i < validTokens.length; i += 10) {
      chunks.push(validTokens.slice(i, i+10).map((t) => t.address));
    }

    const allResults: TokenData[] = [];
    for (const chunk of chunks) {
      const joined = chunk.join(',');
      const res = await fetch(
        `https://api.dexscreener.com/tokens/v1/base/${encodeURIComponent(joined)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) {
        console.error(`Price API failed for chunk: ${res.status}`);
        continue;
      }

      const raw = await res.json();
      if (!Array.isArray(raw)) {
        console.error('Price API returned invalid data');
        continue;
      }

      allResults.push(
        ...raw
          .filter((p): p is DexScreenerPair => typeof p === 'object' && p !== null && 'baseToken' in p)
          .map((pair: DexScreenerPair) => {
            const firestoreEntry = validTokens.find(
              (t) => t.address.toLowerCase() === pair.baseToken.address.toLowerCase()
            );
            return {
              pairAddress: firestoreEntry?.pool ?? '',
              baseToken: {
                address: String(pair.baseToken.address),
                name: firestoreEntry?.name ?? String(pair.baseToken.name),
                symbol: String(pair.baseToken.symbol),
              },
              quoteToken: {
                address: String(pair.quoteToken.address),
                name: String(pair.quoteToken.name),
                symbol: String(pair.quoteToken.symbol),
              },
              priceUsd: String(pair.priceUsd),
              priceChange: pair.priceChange,
              volume: pair.volume,
              marketCap: pair.marketCap,
              liquidity: pair.liquidity ?? { usd: 0 },
              fdv: pair.fdv,
              pairCreatedAt: firestoreEntry?.createdAt ?? (typeof pair.pairCreatedAt === 'number' ? pair.pairCreatedAt : 0),
              info: pair.info?.imageUrl ? { imageUrl: pair.info.imageUrl } : undefined,
              txns: pair.txns,
            } as TokenData;
          })
      );
    }

    // Fetch boosts and build map
    const boostDocs = await getDocs(collection(db, 'boosts'));
    const boostMap: Record<string, number> = {};
    boostDocs.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;
      const addr = String(data.pairAddress).toLowerCase();
      if (typeof data.boostValue === 'number') {
        boostMap[addr] = data.boostValue;
      }
    });

    const withScores = allResults.map((token) => {
      const addr = token.pairAddress.toLowerCase();
      const boostVal = boostMap[addr] ?? 0;
      return {
        ...token,
        boosted: boostVal > 0,
        boostValue: boostVal,
        trendingScore: computeTrending(token, boostVal),
      };
    });

    const topTen = withScores
      .sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0))
      .slice(0, 10);

    const response = topTen.map((t) => ({
      symbol: t.baseToken.symbol,
      name: t.baseToken.name,
      priceUsd: t.priceUsd,
      priceChange24h: t.priceChange?.h24 ?? 0,
      imageUrl: t.info?.imageUrl ?? '/fallback.png',
      trendingScore: t.trendingScore ?? 0,
      pairAddress: t.pairAddress,
    }));

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error in trending API route:', msg);
    return NextResponse.json(
      { error: 'Unable to fetch trending tokens. Please try again later.' },
      { status: 500 }
    );
  }
}


