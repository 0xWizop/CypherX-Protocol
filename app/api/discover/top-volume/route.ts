import { NextResponse } from "next/server";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { unstable_cache } from "next/cache";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch top volume pairs on Base from Dexscreener
// Uses the same approach as the discover page to get top 10 by 24h volume
async function fetchTopVolumeData() {
  try {
    // 1) Load supported tokens from our Firebase 'tokens' collection (same as discover page)
  const tokensSnap = await getDocs(query(collection(db, "tokens")));
    const tokenList = tokensSnap.docs.map((doc) => ({
      poolAddress: doc.data().pool as string || "",
      tokenAddress: doc.data().address as string || "",
      symbol: doc.data().symbol as string || "",
      name: doc.data().name as string || doc.data().symbol || "Unknown",
    }));

    // Filter valid token addresses
    const validTokens = tokenList.filter((token) => 
      /^0x[a-fA-F0-9]{40}$/.test(token.tokenAddress)
    );

    if (validTokens.length === 0) {
    return { pairs: [] };
  }

    // 2) Fetch from DexScreener using the same endpoint as discover page
    // Use smaller chunks to be more conservative with rate limiting
    const tokenChunks: string[][] = [];
    const chunkSize = 10; // Same as discover page
    for (let i = 0; i < validTokens.length; i += chunkSize) {
      tokenChunks.push(validTokens.slice(i, i + chunkSize).map((t) => t.tokenAddress));
    }

    const allResults: any[] = [];
    
    // Process chunks with delays to avoid rate limiting
    for (let i = 0; i < tokenChunks.length; i++) {
      const chunk = tokenChunks[i];
      const joinedChunk = chunk.join(",");
      
      try {
        const res = await fetch(
          `https://api.dexscreener.com/tokens/v1/base/${encodeURIComponent(joinedChunk)}`,
          {
            headers: { Accept: "application/json" },
            // Add cache to reduce API calls
            next: { revalidate: 10 }
          }
        );

        if (!res.ok) {
          console.error(`API fetch failed for chunk, status: ${res.status}`);
          // Add delay even on failure to respect rate limits
          if (i < tokenChunks.length - 1) {
            await sleep(200);
          }
      continue;
    }

        const data: any[] = await res.json();
        
        data.forEach((pair) => {
          if (pair && pair.baseToken && pair.baseToken.address) {
            const firestoreToken = validTokens.find(
              (t) => t.tokenAddress.toLowerCase() === pair.baseToken?.address.toLowerCase()
            );
            
            if (firestoreToken) {
              const volume24h = pair.volume?.h24 || 0;
              // Only include tokens with volume > 0
              if (volume24h > 0) {
                allResults.push({
                  poolAddress: pair.pairAddress || firestoreToken.poolAddress,
                  baseSymbol: pair.baseToken?.symbol || firestoreToken.symbol,
                  baseAddress: pair.baseToken?.address || firestoreToken.tokenAddress,
                  quoteSymbol: pair.quoteToken?.symbol || "WETH",
                  priceUsd: parseFloat(pair.priceUsd || "0"),
                  volume24h: volume24h,
                  priceChange24h: pair.priceChange?.h24 ?? 0,
                  imageUrl: pair.info?.imageUrl || null,
      });
    }
            }
          }
        });

        // Add delay between chunks to avoid rate limiting (more conservative than discover page)
        if (i < tokenChunks.length - 1) {
          await sleep(300); // 300ms delay between chunks
        }
      } catch (error) {
        console.error(`Error fetching chunk:`, error);
        // Continue with next chunk even if one fails
        if (i < tokenChunks.length - 1) {
          await sleep(200);
        }
      }
    }

    // 3) Sort by 24h volume descending and return top 10
    const top10 = allResults
      .filter((r) => r && typeof r.volume24h === 'number' && r.volume24h > 0)
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, 10);

  return { pairs: top10 };
  } catch (error) {
    console.error('Error in fetchTopVolumeData:', error);
    return { pairs: [] };
  }
}

// Cache the data fetching function with 15 second revalidation (longer than discover page to reduce API calls)
const getCachedTopVolume = unstable_cache(
  async () => fetchTopVolumeData(),
  ['top-volume'],
  { revalidate: 15 } // 15 seconds cache
);

export async function GET() {
  try {
    const payload = await getCachedTopVolume();
    return NextResponse.json(payload, { 
      headers: { 
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' 
      } 
    });
  } catch (e) {
    console.error('Error in top-volume API:', e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}


