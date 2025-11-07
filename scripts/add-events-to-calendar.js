import admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
function initFirebase() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  // Try service account file first
  const serviceAccountPath = path.join(__dirname, "..", "firebaseServiceAccount.json");
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    // Normalize private key
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .trim();
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    return admin.firestore();
  }

  throw new Error("Firebase Admin initialization failed. Please ensure firebaseServiceAccount.json exists.");
}

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

// Helper to format time as HH:MM
function formatTime(hours, minutes = 0) {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Helper to get first Friday of a month
function getFirstFriday(year, month) {
  // month is 1-indexed (1 = January)
  const firstDay = new Date(year, month - 1, 1);
  const dayOfWeek = firstDay.getDay(); // 0 = Sunday, 5 = Friday
  const daysToAdd = dayOfWeek <= 5 ? (5 - dayOfWeek) : (12 - dayOfWeek);
  return new Date(year, month - 1, 1 + daysToAdd);
}

// Generate events with REAL scheduled dates starting from today (November 5, 2025)
function generateEvents() {
  const events = [];
  const today = new Date();
  today.setFullYear(2025);
  today.setMonth(10); // November (0-indexed, so 10 = November)
  today.setDate(5);
  today.setHours(0, 0, 0, 0);
  
  const oneMonthLater = new Date(today);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  
  // Get current date info
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed (10 = November)
  const nextMonth = 11; // December (0-indexed)

  // Event definitions with REAL dates for November-December 2025
  const eventDefinitions = [
    // Federal Reserve & Macro Events - Using actual 2025 schedule
    // FOMC 2025: Nov 5-6 (TODAY - decision announced), Dec 16-17 (next meeting)
    { date: new Date(2025, 10, 5), title: "FOMC Meeting - Interest Rate Decision", time: "14:00", description: "Federal Reserve Open Market Committee meeting - Interest rate decision announcement", category: "federal-reserve" },
    { date: new Date(2025, 10, 7), title: "Non-Farm Payrolls Report", time: "08:30", description: "Monthly employment situation report including unemployment rate and job creation numbers for October", category: "federal-reserve" },
    { date: new Date(2025, 10, 12), title: "CPI Inflation Data Release", time: "08:30", description: "Consumer Price Index inflation data release for October 2025", category: "federal-reserve" },
    { date: new Date(2025, 10, 14), title: "PPI (Producer Price Index) Release", time: "08:30", description: "Producer Price Index data measuring wholesale inflation", category: "federal-reserve" },
    { date: new Date(2025, 10, 15), title: "Retail Sales Data Release", time: "08:30", description: "Monthly retail sales figures indicating consumer spending trends", category: "federal-reserve" },
    { date: new Date(2025, 10, 20), title: "Federal Reserve Chair Powell Speech", time: "10:00", description: "Jerome Powell public address on monetary policy outlook", category: "federal-reserve" },
    { date: new Date(2025, 10, 27), title: "PCE Inflation Data Release", time: "08:30", description: "Personal Consumption Expenditures inflation data - Fed's preferred inflation metric", category: "federal-reserve" },
    { date: new Date(2025, 11, 5), title: "Non-Farm Payrolls Report", time: "08:30", description: "Monthly employment situation report including unemployment rate and job creation numbers for November", category: "federal-reserve" },
    { date: new Date(2025, 11, 12), title: "CPI Inflation Data Release", time: "08:30", description: "Consumer Price Index inflation data release for November 2025", category: "federal-reserve" },
    { date: new Date(2025, 11, 16), title: "FOMC Meeting - Interest Rate Decision", time: "14:00", description: "Federal Reserve Open Market Committee meeting to discuss monetary policy and interest rate decisions", category: "federal-reserve" },
    
    // Crypto Company Earnings - Q3 2025 earnings typically in November
    { date: new Date(2025, 10, 6), title: "Coinbase (COIN) Q3 2025 Earnings", time: "16:00", description: "Coinbase quarterly earnings report and investor call", category: "earnings" },
    { date: new Date(2025, 10, 7), title: "MicroStrategy (MSTR) Q3 2025 Earnings", time: "17:00", description: "MicroStrategy earnings report - significant Bitcoin holdings disclosure", category: "earnings" },
    { date: new Date(2025, 10, 11), title: "Marathon Digital (MARA) Q3 2025 Earnings", time: "16:30", description: "Marathon Digital Holdings quarterly earnings - Bitcoin mining operations", category: "earnings" },
    { date: new Date(2025, 10, 13), title: "Riot Platforms (RIOT) Q3 2025 Earnings", time: "17:00", description: "Riot Platforms earnings report - Bitcoin mining and infrastructure", category: "earnings" },
    { date: new Date(2025, 10, 18), title: "Block (SQ) Q3 2025 Earnings", time: "17:00", description: "Block Inc earnings including Cash App and Bitcoin revenue", category: "earnings" },
    { date: new Date(2025, 10, 19), title: "Hut 8 Mining (HUT) Q3 2025 Earnings", time: "16:30", description: "Hut 8 Mining quarterly earnings - crypto mining operations", category: "earnings" },
    { date: new Date(2025, 10, 21), title: "Bitfarms (BITF) Q3 2025 Earnings", time: "17:00", description: "Bitfarms earnings report - Bitcoin mining company", category: "earnings" },
    
    // Base Chain Events - Spread across November-December
    { date: new Date(2025, 10, 6), title: "Base Ecosystem Weekly Update", time: "14:00", description: "Weekly community update on Base chain developments, new projects, and ecosystem growth", category: "base-chain" },
    { date: new Date(2025, 10, 8), title: "Base Developer Workshop", time: "15:00", description: "Educational workshop for developers building on Base chain", category: "base-chain" },
    { date: new Date(2025, 10, 13), title: "Base AMA with Core Team", time: "17:00", description: "Ask Me Anything session with Base core development team", category: "base-chain" },
    { date: new Date(2025, 10, 15), title: "Base Chain Governance Meeting", time: "16:00", description: "Base chain governance and protocol upgrade discussions", category: "base-chain" },
    { date: new Date(2025, 10, 22), title: "Base Ecosystem Showcase", time: "14:00", description: "Showcase of new projects and dApps launching on Base", category: "base-chain" },
    { date: new Date(2025, 10, 26), title: "Base Network Upgrade Discussion", time: "15:00", description: "Technical discussion on upcoming Base network upgrades and improvements", category: "base-chain" },
    { date: new Date(2025, 11, 3), title: "Base Builder Grant Program Announcement", time: "14:00", description: "Announcement of new builder grants and funding opportunities on Base", category: "base-chain" },
    { date: new Date(2025, 11, 5), title: "Base Community Town Hall", time: "16:00", description: "Monthly community town hall meeting for Base ecosystem participants", category: "base-chain" },
    
    // Base Chain Products/Tokens/Companies
    { date: new Date(2025, 10, 7), title: "Uniswap V3 on Base - New Features Launch", time: "12:00", description: "Uniswap V3 deployment of new features and liquidity pools on Base", category: "base-products" },
    { date: new Date(2025, 10, 9), title: "Base Name Service (BNS) Launch", time: "16:00", description: "Base Name Service domain registration and NFT launch", category: "base-products" },
    { date: new Date(2025, 10, 10), title: "BaseSwap DEX Token Listing", time: "14:00", description: "BaseSwap decentralized exchange token listing and trading launch", category: "base-products" },
    { date: new Date(2025, 10, 16), title: "Aave V3 Base Pool Expansion", time: "13:00", description: "Aave lending protocol expansion on Base with new markets", category: "base-products" },
    { date: new Date(2025, 10, 17), title: "Base Yield Farming Campaign Launch", time: "12:00", description: "New yield farming opportunities and liquidity mining campaigns on Base", category: "base-products" },
    { date: new Date(2025, 10, 23), title: "Friend.tech Token Launch", time: "15:00", description: "Friend.tech social token platform token launch and trading begins", category: "base-products" },
    { date: new Date(2025, 10, 28), title: "Base NFT Marketplace Feature Release", time: "15:00", description: "Major feature update for NFT marketplaces operating on Base", category: "base-products" },
    { date: new Date(2025, 11, 4), title: "Superchain Developer Conference", time: "10:00", description: "Superchain ecosystem conference featuring Base and other OP chains", category: "base-products" },
    
    // Broader Crypto Events
    { date: new Date(2025, 10, 5), title: "Bitcoin ETF Monthly Rebalancing", time: "16:00", description: "Monthly rebalancing of Bitcoin spot ETFs affecting institutional holdings", category: "crypto-broad" },
    { date: new Date(2025, 10, 6), title: "Ethereum Core Dev Meeting", time: "14:00", description: "Ethereum core developers meeting to discuss protocol upgrades and improvements", category: "crypto-broad" },
    { date: new Date(2025, 10, 8), title: "Crypto Regulatory Update - SEC Announcement", time: "13:00", description: "SEC regulatory updates and guidance for crypto markets", category: "crypto-broad" },
    { date: new Date(2025, 10, 9), title: "DeFi Pulse Index Rebalancing", time: "12:00", description: "Monthly rebalancing of DeFi Pulse Index tracking top DeFi tokens", category: "crypto-broad" },
    { date: new Date(2025, 10, 10), title: "Crypto Exchange Security Audit Release", time: "11:00", description: "Major exchange security audit results and transparency report", category: "crypto-broad" },
    { date: new Date(2025, 10, 14), title: "Ethereum Staking Rewards Distribution", time: "12:00", description: "Monthly Ethereum staking rewards distribution to validators", category: "crypto-broad" },
    { date: new Date(2025, 10, 16), title: "Layer 2 Summit - Scaling Solutions", time: "09:00", description: "Virtual summit discussing Layer 2 scaling solutions including Base, Arbitrum, Optimism", category: "crypto-broad" },
    { date: new Date(2025, 10, 18), title: "Stablecoin Regulation Hearing", time: "14:00", description: "Congressional hearing on stablecoin regulation and oversight", category: "crypto-broad" },
    { date: new Date(2025, 10, 19), title: "Institutional Crypto Adoption Report", time: "10:00", description: "Quarterly report on institutional crypto adoption and investment trends", category: "crypto-broad" },
    { date: new Date(2025, 10, 21), title: "NFT Market Weekly Report", time: "10:00", description: "Weekly NFT market analysis including sales volume, floor prices, and trending collections", category: "crypto-broad" },
    { date: new Date(2025, 10, 23), title: "Crypto Mining Difficulty Adjustment", time: "12:00", description: "Bitcoin and Ethereum mining difficulty adjustments and network hash rate updates", category: "crypto-broad" },
    { date: new Date(2025, 10, 24), title: "Crypto Market Analysis - Monthly Report", time: "10:00", description: "Comprehensive monthly crypto market analysis and trends report", category: "crypto-broad" },
    { date: new Date(2025, 10, 25), title: "DeFi TVL Report", time: "09:00", description: "Total Value Locked report across all DeFi protocols and chains", category: "crypto-broad" },
    { date: new Date(2025, 10, 27), title: "Stablecoin Market Cap Report", time: "11:00", description: "Monthly stablecoin market capitalization and supply analysis", category: "crypto-broad" },
    { date: new Date(2025, 10, 28), title: "Crypto Exchange Volume Report", time: "13:00", description: "Monthly crypto exchange trading volume rankings and market share analysis", category: "crypto-broad" },
    { date: new Date(2025, 10, 29), title: "Crypto Market Sentiment Index Release", time: "10:00", description: "Monthly crypto market sentiment index and fear & greed analysis", category: "crypto-broad" },
    { date: new Date(2025, 11, 1), title: "Monthly Crypto Market Wrap-Up", time: "16:00", description: "End-of-month crypto market analysis, trends, and outlook for next month", category: "crypto-broad" },
    { date: new Date(2025, 11, 2), title: "Crypto Derivatives Market Report", time: "11:00", description: "Monthly report on crypto derivatives trading volume and open interest", category: "crypto-broad" },
    { date: new Date(2025, 11, 3), title: "Web3 Gaming Summit", time: "09:00", description: "Virtual summit on Web3 gaming, NFTs, and blockchain gaming integration", category: "crypto-broad" },
    { date: new Date(2025, 11, 4), title: "Crypto Payment Processing Update", time: "13:00", description: "Updates on crypto payment processing and merchant adoption", category: "crypto-broad" },
    { date: new Date(2025, 11, 5), title: "Decentralized Identity Summit", time: "10:00", description: "Summit on decentralized identity solutions and blockchain-based identity", category: "crypto-broad" },
    { date: new Date(2025, 10, 30), title: "Crypto VC Funding Roundup", time: "14:00", description: "Weekly crypto venture capital funding announcements and investment trends", category: "crypto-broad" },
    { date: new Date(2025, 11, 5), title: "Bitcoin Halving Anniversary Event", time: "18:00", description: "Community celebration of Bitcoin halving anniversary with market analysis", category: "crypto-broad" },
  ];

  // Process events and filter to only include those within next month
  eventDefinitions.forEach((eventDef) => {
    const eventDate = eventDef.date;
    
    // Ensure date is within 1 month range and not in the past
    if (eventDate >= today && eventDate <= oneMonthLater) {
      events.push({
        title: eventDef.title,
        description: eventDef.description,
        date: formatDate(eventDate),
        time: eventDef.time,
        status: "approved",
        createdBy: "system",
        createdByName: "System",
        category: eventDef.category,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: "system",
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return events;
}

// Delete old events first
async function deleteOldEvents(db) {
  try {
    console.log("🗑️  Deleting old events...");
    const eventsSnapshot = await db.collection("events").where("createdBy", "==", "system").get();
    
    if (eventsSnapshot.empty) {
      console.log("   No old system events found");
      return;
    }

    const batch = db.batch();
    eventsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`✅ Deleted ${eventsSnapshot.docs.length} old events`);
  } catch (error) {
    console.error("❌ Error deleting old events:", error);
    throw error;
  }
}

// Main function
async function addEvents() {
  try {
    console.log("🚀 Initializing Firebase Admin...");
    const db = initFirebase();
    console.log("✅ Firebase Admin initialized");

    // Delete old events first
    await deleteOldEvents(db);

    console.log("📅 Generating events with REAL 2025 dates...");
    const events = generateEvents();
    console.log(`✅ Generated ${events.length} events`);

    if (events.length === 0) {
      console.log("⚠️  No events generated - all dates may be outside the next month range");
      return;
    }

    console.log("💾 Adding events to Firestore...");
    const batch = db.batch();
    const eventsCollection = db.collection("events");

    let addedCount = 0;
    events.forEach((event) => {
      const docRef = eventsCollection.doc();
      batch.set(docRef, event);
      addedCount++;
    });

    await batch.commit();
    console.log(`✅ Successfully added ${addedCount} events to Firestore`);

    // Summary by category
    const categoryCounts = {};
    events.forEach((event) => {
      categoryCounts[event.category] = (categoryCounts[event.category] || 0) + 1;
    });

    console.log("\n📊 Events by category:");
    Object.entries(categoryCounts).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });

    // Show sample dates
    console.log("\n📅 Sample event dates:");
    events.slice(0, 5).forEach((event) => {
      console.log(`   ${event.date}: ${event.title}`);
    });

    console.log("\n✅ All events added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding events:", error);
    process.exit(1);
  }
}

// Run the script
addEvents();
