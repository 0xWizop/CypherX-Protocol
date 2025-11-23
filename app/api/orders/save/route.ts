import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { 
  getUserByWalletAddress, 
  calculateCashback, 
  calculateTier, 
  processReferralReward, 
  updateUserRewards 
} from "@/lib/rewards-utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      type, // 'BUY' | 'SELL'
      tokenAddress,
      tokenSymbol,
      tokenName,
      amount,
      amountDisplay,
      inputToken,
      outputToken,
      executedPrice,
      txHash,
      blockNumber,
      gasUsed,
      gasPrice,
      protocol = '0x',
      pairAddress,
    } = body;

    if (!walletAddress || !type || !tokenAddress || !txHash) {
      return NextResponse.json(
        { error: "Missing required fields: walletAddress, type, tokenAddress, txHash" },
        { status: 400 }
      );
    }

    const db = adminDb();
    if (!db) {
      console.error("❌ Database connection failed - adminDb returned null");
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }

    const timestampNow = Timestamp.now();

    // 1. Save Order
    const orderData: any = {
      walletAddress,
      type: type as 'BUY' | 'SELL' | 'SWAP',
      status: 'EXECUTED',
      tokenAddress,
      tokenSymbol,
      tokenName,
      amount,
      amountDisplay,
      inputToken,
      outputToken,
      executedAt: timestampNow,
      executedPrice,
      executedAmount: amount,
      txHash,
      createdAt: timestampNow,
      updatedAt: timestampNow,
      timestamp: timestampNow,
      metadata: {
        protocol,
        pairAddress,
        gasUsed,
        gasPrice,
      },
    };

    console.log("💾 Saving order to Firebase:", { walletAddress, type, tokenSymbol, txHash });
    const orderRef = await db.collection('wallet_orders').add(orderData);
    console.log("✅ Order saved with ID:", orderRef.id);

    // 2. Save Transaction
    // Calculate input/output amounts and values for proper transaction tracking
    const isBuy = type === 'BUY';
    // For BUY: input is ETH (amountDisplay), output is token (amount)
    // For SELL: input is token (amount), output is ETH (amountDisplay)
    const inputAmount = isBuy ? amountDisplay : amount;
    const outputAmount = isBuy ? amount : amountDisplay;
    
    // Calculate USD values
    // For BUY: inputValue = ETH amount * ETH price, outputValue = token amount * token price (executedPrice)
    // For SELL: inputValue = token amount * token price, outputValue = ETH amount * ETH price
    // Since we don't have ETH price here, we'll calculate it from the swap ratio
    // executedPrice is the token price, so: ETH_price = (token_amount * executedPrice) / ETH_amount
    let inputValue = 0;
    let outputValue = 0;
    
    if (isBuy && amountDisplay && amount && executedPrice) {
      // BUY: ETH -> Token
      const ethAmount = parseFloat(amountDisplay);
      const tokenAmount = parseFloat(amount);
      const tokenPrice = parseFloat(executedPrice);
      
      // Calculate ETH price from swap ratio
      const ethPrice = (tokenAmount * tokenPrice) / ethAmount;
      inputValue = ethAmount * ethPrice;
      outputValue = tokenAmount * tokenPrice;
    } else if (!isBuy && amount && amountDisplay && executedPrice) {
      // SELL: Token -> ETH
      const tokenAmount = parseFloat(amount);
      const ethAmount = parseFloat(amountDisplay);
      const tokenPrice = parseFloat(executedPrice);
      
      // Calculate ETH price from swap ratio
      const ethPrice = (tokenAmount * tokenPrice) / ethAmount;
      inputValue = tokenAmount * tokenPrice;
      outputValue = ethAmount * ethPrice;
    } else {
      // Fallback: use executedPrice if available
      if (isBuy && executedPrice) {
        inputValue = parseFloat(amountDisplay || '0') * 3000; // Rough ETH price estimate
        outputValue = parseFloat(amount || '0') * parseFloat(executedPrice);
      } else if (executedPrice) {
        inputValue = parseFloat(amount || '0') * parseFloat(executedPrice);
        outputValue = parseFloat(amountDisplay || '0') * 3000; // Rough ETH price estimate
      }
    }

    // Normalize token addresses to lowercase for consistent matching
    const normalizedTokenAddress = tokenAddress?.toLowerCase();
    const normalizedInputToken = (isBuy ? 
      (inputToken === 'ETH' ? '0x4200000000000000000000000000000000000006' : (inputToken || '0x4200000000000000000000000000000000000006')) : 
      (inputToken || tokenAddress))?.toLowerCase();
    const normalizedOutputToken = (isBuy ? 
      (outputToken || tokenAddress) : 
      (outputToken === 'ETH' ? '0x4200000000000000000000000000000000000006' : (outputToken || '0x4200000000000000000000000000000000000006')))?.toLowerCase();

    const transactionData: any = {
      walletAddress,
      type: 'swap', // Use 'swap' so APIs can find it
      txHash,
      blockNumber,
      tokenAddress: normalizedTokenAddress, // Save normalized token address
      tokenSymbol,
      tokenName,
      inputToken: normalizedInputToken,
      outputToken: normalizedOutputToken,
      inputAmount: inputAmount,
      outputAmount: outputAmount,
      inputValue: inputValue,
      outputValue: outputValue,
      amount: outputAmount, // Keep for backward compatibility
      amountDisplay: amountDisplay,
      price: executedPrice,
      gasUsed,
      gasPrice,
      status: 'CONFIRMED',
      timestamp: timestampNow,
      createdAt: timestampNow,
      transactionHash: txHash, // Also save as transactionHash for compatibility
      metadata: {
        protocol,
        pairAddress,
      },
    };

    console.log("💾 Saving transaction to Firebase");
    await db.collection('wallet_transactions').add(transactionData);
    console.log("✅ Transaction saved");

    // 3. Update/Create Position
    const positionQuery = db
      .collection('wallet_positions')
      .where('walletAddress', '==', walletAddress)
      .where('tokenAddress', '==', tokenAddress)
      .where('isOpen', '==', true)
      .limit(1);

    const positionSnapshot = await positionQuery.get();

    if (positionSnapshot.empty) {
      // Create new position
      if (type === 'BUY') {
        const positionData: any = {
          walletAddress,
          tokenAddress,
          tokenSymbol,
          tokenName,
          amount,
          entryPrice: executedPrice || '0',
          currentPrice: executedPrice,
          lastPriceUpdate: timestampNow,
          isOpen: true,
          openedAt: timestampNow,
          buyCount: 1,
          sellCount: 0,
          totalVolume: amount,
          createdAt: timestampNow,
          updatedAt: timestampNow,
          metadata: {
            firstBuy: timestampNow,
            lastTrade: timestampNow,
          },
        };

        console.log("💾 Creating new position in Firebase");
        await db.collection('wallet_positions').add(positionData);
        console.log("✅ Position created");
      }
    } else {
      // Update existing position
      const positionDoc = positionSnapshot.docs[0];
      const currentPosition = positionDoc.data();

      if (type === 'BUY') {
        // Increase position
        const currentAmount = parseFloat(currentPosition.amount || '0');
        const newAmount = parseFloat(amount);
        const totalAmount = currentAmount + newAmount;
        const currentEntryPrice = parseFloat(currentPosition.entryPrice || '0');
        const newPrice = parseFloat(executedPrice || '0');
        
        // Weighted average entry price
        const newEntryPrice = currentAmount > 0
          ? ((currentEntryPrice * currentAmount) + (newPrice * newAmount)) / totalAmount
          : newPrice;

        console.log("💾 Updating existing position (BUY)");
        await positionDoc.ref.update({
          amount: totalAmount.toString(),
          entryPrice: newEntryPrice.toString(),
          currentPrice: executedPrice,
          lastPriceUpdate: timestampNow,
          buyCount: (currentPosition.buyCount || 0) + 1,
          totalVolume: (parseFloat(currentPosition.totalVolume || '0') + parseFloat(amount)).toString(),
          updatedAt: timestampNow,
          'metadata.lastTrade': timestampNow,
        });
        console.log("✅ Position updated");
      } else if (type === 'SELL') {
        // Decrease position
        const currentAmount = parseFloat(currentPosition.amount || '0');
        const sellAmount = parseFloat(amount);
        const newAmount = currentAmount - sellAmount;

        if (newAmount <= 0) {
          // Close position
          console.log("💾 Closing position (SELL)");
          await positionDoc.ref.update({
            amount: '0',
            isOpen: false,
            closedAt: timestampNow,
            sellCount: (currentPosition.sellCount || 0) + 1,
            totalVolume: (parseFloat(currentPosition.totalVolume || '0') + parseFloat(amount)).toString(),
            updatedAt: timestampNow,
            'metadata.lastTrade': timestampNow,
          });
          console.log("✅ Position closed");
        } else {
          // Update position
          console.log("💾 Updating existing position (SELL)");
          await positionDoc.ref.update({
            amount: newAmount.toString(),
            currentPrice: executedPrice,
            lastPriceUpdate: timestampNow,
            sellCount: (currentPosition.sellCount || 0) + 1,
            totalVolume: (parseFloat(currentPosition.totalVolume || '0') + parseFloat(amount)).toString(),
            updatedAt: timestampNow,
            'metadata.lastTrade': timestampNow,
          });
          console.log("✅ Position updated");
        }
      }
    }

    // Process rewards (cashback and referrals) if user account exists
    let rewardsProcessed = false;
    let cashbackAmount = 0;
    let referralReward = 0;

    try {
      // Get user by wallet address
      const { userId, userData } = await getUserByWalletAddress(walletAddress);

      if (userId && userData) {
        // Calculate swap value in USD (use outputValue as it represents the token received value)
        const swapValueUSD = outputValue || inputValue || 0;
        
        if (swapValueUSD > 0) {
          // Calculate platform fee (0.75% of swap value)
          // Note: 0.15% goes to 0x protocol, remaining 0.60% available for cashback/referrals
          const platformFee = swapValueUSD * 0.0075;

          // Get user's tier
          const userPoints = userData.points || 0;
          const tier = calculateTier(userPoints);

          // Calculate cashback
          cashbackAmount = calculateCashback(swapValueUSD, tier);

          // Update user rewards
          await updateUserRewards(userId, swapValueUSD, cashbackAmount, platformFee);

          // Process referral rewards if user was referred
          if (userData.referredBy) {
            const referralResult = await processReferralReward(userId, swapValueUSD, platformFee);
            referralReward = referralResult.referralReward;
          }

          rewardsProcessed = true;
          console.log(`✅ Rewards processed for user ${userId}:`, {
            cashback: cashbackAmount,
            referralReward,
            tier,
            swapValueUSD
          });
        }
      } else {
        console.log(`ℹ️  No user account found for wallet ${walletAddress}, skipping rewards`);
      }
    } catch (error) {
      console.error('❌ Error processing rewards:', error);
      // Don't fail the order save if rewards fail
    }

    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
      message: 'Order and position saved successfully',
      rewards: rewardsProcessed ? {
        cashbackAmount,
        referralReward,
        processed: true
      } : {
        processed: false,
        message: 'No user account linked to wallet'
      }
    });
  } catch (error: any) {
    console.error('Error saving order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save order' },
      { status: 500 }
    );
  }
}

