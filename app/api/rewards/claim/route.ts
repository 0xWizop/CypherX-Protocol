import { NextResponse } from 'next/server';
import { adminDb, auth } from '@/lib/firebase-admin';
import { ethers } from 'ethers';

// Treasury wallet configuration
// IMPORTANT: Store these in environment variables!
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

// Minimum claim amount (in ETH) to prevent dust claims
const MIN_CLAIM_AMOUNT = 0.0001; // ~$0.25 at $2500 ETH

// Helper function to generate referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'CYPHERX';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Send ETH from treasury to user wallet
async function sendRewardsToUser(
  toAddress: string, 
  amountInEth: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!TREASURY_PRIVATE_KEY) {
      console.error('❌ Treasury private key not configured');
      return { success: false, error: 'Treasury not configured' };
    }

    // Connect to Base network
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const treasuryWallet = new ethers.Wallet(TREASURY_PRIVATE_KEY, provider);

    // Check treasury balance
    const treasuryBalance = await provider.getBalance(treasuryWallet.address);
    const amountWei = ethers.parseEther(amountInEth.toString());

    console.log(`💰 Treasury balance: ${ethers.formatEther(treasuryBalance)} ETH`);
    console.log(`📤 Sending: ${amountInEth} ETH to ${toAddress}`);

    // Ensure treasury has enough balance (including gas buffer)
    const gasBuffer = ethers.parseEther('0.001'); // 0.001 ETH for gas
    if (treasuryBalance < amountWei + gasBuffer) {
      console.error('❌ Treasury balance insufficient');
      return { success: false, error: 'Treasury balance insufficient. Please try again later.' };
    }

    // Estimate gas
    const gasEstimate = await provider.estimateGas({
      from: treasuryWallet.address,
      to: toAddress,
      value: amountWei
    });

    // Get current gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('0.1', 'gwei');

    // Send transaction
    const tx = await treasuryWallet.sendTransaction({
      to: toAddress,
      value: amountWei,
      gasLimit: gasEstimate,
      gasPrice: gasPrice
    });

    console.log(`📝 Transaction sent: ${tx.hash}`);

    // Wait for confirmation (1 block)
    const receipt = await tx.wait(1);

    if (receipt?.status === 1) {
      console.log(`✅ Transaction confirmed: ${tx.hash}`);
      return { success: true, txHash: tx.hash };
    } else {
      console.error('❌ Transaction failed');
      return { success: false, error: 'Transaction failed on-chain' };
    }
  } catch (error: any) {
    console.error('❌ Error sending rewards:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send rewards' 
    };
  }
}

// Claim ETH rewards
export async function POST(request: any) {
  try {
    let db;
    try {
      db = adminDb();
    } catch (error) {
      console.error('Firebase Admin initialization failed:', error);
      return NextResponse.json({ 
        error: 'Database connection failed. Please check Firebase Admin configuration and IAM permissions.' 
      }, { status: 500 });
    }
    
    if (!db) {
      return NextResponse.json({ 
        error: 'Database connection failed' 
      }, { status: 500 });
    }
    
    let userId: string | undefined;

    // Try Firebase auth token first
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      try {
        const decodedToken = await auth().verifyIdToken(token);
        userId = decodedToken.uid;
      } catch (error) {
        console.error('Token verification failed:', error);
        // Fall through to wallet address lookup
      }
    }

    const body = await request.json();

    // Fallback: Look up user by wallet address
    if (!userId) {
      const walletAddress = body.walletAddress;
      
      if (!walletAddress) {
        return NextResponse.json({ error: 'Unauthorized: No token or wallet address provided' }, { status: 401 });
      }

      // Find user by wallet address
      const userQuery = db.collection('users').where('walletAddress', '==', walletAddress.toLowerCase()).limit(1);
      const userSnapshot = await userQuery.get();
      
      if (userSnapshot.empty) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      userId = userSnapshot.docs[0].id;
    }

    // Get user's rewards data
    const rewardsRef = db.collection('rewards').doc(userId);
    const rewardsDoc = await rewardsRef.get();

    if (!rewardsDoc.exists) {
      // Create empty rewards document for user
      await rewardsRef.set({
        ethRewards: 0,
        referralCode: generateReferralCode(),
        referrals: 0,
        referralRate: 30,
        volumeTraded: 0,
        transactions: 0,
        lastUpdated: new Date().toISOString()
      });
      
      return NextResponse.json({ error: 'No rewards to claim' }, { status: 400 });
    }

    const rewardsData: any = rewardsDoc.data();
    const claimableAmount = rewardsData?.ethRewards || 0;

    if (claimableAmount <= 0) {
      return NextResponse.json({ error: 'No rewards to claim' }, { status: 400 });
    }

    if (claimableAmount < MIN_CLAIM_AMOUNT) {
      return NextResponse.json({ 
        error: `Minimum claim amount is ${MIN_CLAIM_AMOUNT} ETH. You have ${claimableAmount.toFixed(6)} ETH.` 
      }, { status: 400 });
    }

    // Check if user has a wallet address
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData: any = userDoc.data();
    const walletAddress = userData?.walletAddress;

    if (!walletAddress) {
      return NextResponse.json({ 
        error: 'No wallet address found. Please connect your wallet first.' 
      }, { status: 400 });
    }

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return NextResponse.json({ 
        error: 'Invalid wallet address' 
      }, { status: 400 });
    }

    // Check for pending claims (prevent double-claiming)
    const pendingClaimsSnapshot = await db.collection('claimTransactions')
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .get();

    if (!pendingClaimsSnapshot.empty) {
      return NextResponse.json({ 
        error: 'You have a pending claim. Please wait for it to complete.' 
      }, { status: 400 });
    }

    // Create claim transaction record
    const claimRef = await db.collection('claimTransactions').add({
      userId,
      walletAddress,
      amount: claimableAmount,
      status: 'pending',
      timestamp: new Date().toISOString(),
      transactionHash: null
    });

    // Reset user's ETH rewards to 0 BEFORE sending (prevents race conditions)
    await rewardsRef.update({
      ethRewards: 0,
      lastClaimed: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });

    // Send ETH to user's wallet
    const sendResult = await sendRewardsToUser(walletAddress, claimableAmount);

    if (sendResult.success && sendResult.txHash) {
      // Update claim transaction status to completed
      await claimRef.update({
        status: 'completed',
        transactionHash: sendResult.txHash,
        completedAt: new Date().toISOString()
      });

      // Add to user's claim history
      await db.collection('users').doc(userId).collection('claimHistory').add({
        claimId: claimRef.id,
        amount: claimableAmount,
        timestamp: new Date().toISOString(),
        status: 'completed',
        transactionHash: sendResult.txHash
      });

      console.log(`✅ Claim successful for user ${userId}: ${claimableAmount} ETH, TX: ${sendResult.txHash}`);

      return NextResponse.json({
        success: true,
        claimId: claimRef.id,
        amount: claimableAmount,
        transactionHash: sendResult.txHash,
        message: 'Rewards claimed successfully! ETH has been sent to your wallet.'
      });
    } else {
      // Transaction failed - restore user's rewards
      await rewardsRef.update({
        ethRewards: claimableAmount,
        lastUpdated: new Date().toISOString()
      });

      // Update claim status to failed
      await claimRef.update({
        status: 'failed',
        error: sendResult.error,
        failedAt: new Date().toISOString()
      });

      console.error(`❌ Claim failed for user ${userId}: ${sendResult.error}`);

      return NextResponse.json({ 
        error: sendResult.error || 'Failed to send rewards. Please try again.' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error claiming rewards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get claim history
export async function GET(request: any) {
  try {
    let db;
    try {
      db = adminDb();
    } catch (error) {
      console.error('Firebase Admin initialization failed:', error);
      return NextResponse.json({ 
        error: 'Database connection failed. Please check Firebase Admin configuration and IAM permissions.' 
      }, { status: 500 });
    }
    
    if (!db) {
      return NextResponse.json({ 
        error: 'Database connection failed' 
      }, { status: 500 });
    }
    
    let userId: string | undefined;

    // Try Firebase auth token first
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      try {
        const decodedToken = await auth().verifyIdToken(token);
        userId = decodedToken.uid;
      } catch (error) {
        console.error('Token verification failed:', error);
        // Fall through to wallet address lookup
      }
    }

    // Fallback: Look up user by wallet address
    if (!userId) {
      const { searchParams } = new URL(request.url);
      const walletAddress = searchParams.get('walletAddress');
      
      if (!walletAddress) {
        return NextResponse.json({ error: 'Unauthorized: No token or wallet address provided' }, { status: 401 });
      }

      // Find user by wallet address
      const userQuery = db.collection('users').where('walletAddress', '==', walletAddress.toLowerCase()).limit(1);
      const userSnapshot = await userQuery.get();
      
      if (userSnapshot.empty) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      userId = userSnapshot.docs[0].id;
    }

    // Get user's claim history
    const claimHistorySnapshot = await db.collection('users')
      .doc(userId)
      .collection('claimHistory')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const claimHistory = claimHistorySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get pending claims
    const pendingClaimsSnapshot = await db.collection('claimTransactions')
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .get();

    const pendingClaims = pendingClaimsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      claimHistory,
      pendingClaims,
      totalClaims: claimHistory.length
    });
  } catch (error) {
    console.error('Error fetching claim history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
