# Advanced Orders System (Limit Orders & Stop-Loss)

## Overview

This system implements limit orders, stop-loss orders, and stop-limit orders for your DEX trading platform using 0x Protocol. Since 0x Protocol executes swaps immediately, we've built an order management system that monitors prices and executes orders when conditions are met.

## Architecture

### Components

1. **Order Management API** (`/api/orders/`)
   - `create` - Create new limit/stop orders
   - `list` - Get user's orders
   - `cancel` - Cancel pending orders
   - `monitor` - Background service that checks price conditions
   - `execute` - Executes orders that meet conditions

2. **Order Monitoring Service**
   - Checks pending orders every 5 minutes
   - Compares current prices with order conditions
   - Updates order status when conditions are met

3. **Order Execution Service**
   - Executes orders via 0x Protocol API
   - Handles transaction signing and submission
   - Updates order status with transaction hash

4. **UI Component** (`OrderManagement.tsx`)
   - Create limit/stop orders
   - View pending orders
   - Cancel orders
   - Monitor order status

## Order Types

### 1. Limit Buy
- **Trigger**: When token price ≤ target price
- **Action**: Buy token using ETH
- **Use Case**: Buy at a lower price

### 2. Limit Sell
- **Trigger**: When token price ≥ target price
- **Action**: Sell token for ETH
- **Use Case**: Sell at a higher price

### 3. Stop Loss
- **Trigger**: When token price ≤ stop price
- **Action**: Sell token immediately (market order)
- **Use Case**: Limit losses when price drops

### 4. Stop Limit (Future)
- **Trigger**: Stop price hit, then limit price
- **Action**: Sell at limit price after stop triggers
- **Use Case**: More control over stop-loss execution

## Setup Instructions

### 1. Environment Variables

Add to your `.env.local`:
```bash
CRON_SECRET=your-secret-key-here  # For protecting cron endpoints
ZEROX_API_KEY=your-0x-api-key     # Already configured
```

### 2. Deploy Firestore Rules

The rules for `limit_orders` collection have been added. Deploy them:
```bash
npm run firebase:deploy-rules
```

### 3. Set Up Cron Jobs

**Option A: Vercel Cron Jobs (Recommended)**

The `vercel.json` file is already configured. After deployment to Vercel:
- Monitoring runs every 5 minutes
- Execution runs every 2 minutes

**Option B: External Cron Service**

Use a service like cron-job.org:
1. Create two cron jobs
2. URL 1: `https://yourdomain.com/api/orders/monitor` (every 5 min)
3. URL 2: `https://yourdomain.com/api/orders/execute` (every 2 min)
4. Add header: `Authorization: Bearer YOUR_CRON_SECRET`

**Option C: Self-Hosted**

Use the Node.js example in `scripts/setup-order-monitoring.js`

### 4. Integrate UI Component

Add to your dashboard or swap interface:

```tsx
import OrderManagement from "@/app/components/OrderManagement";

// In your component:
<OrderManagement 
  walletAddress={walletAddress}
  onOrderCreate={() => console.log("Order created!")}
/>
```

## Important Considerations

### ⚠️ Private Key Management

**Current Status**: Order execution requires wallet private keys, which is currently a placeholder.

**Production Requirements**:
1. **Secure Key Storage**: 
   - Use AWS KMS, HashiCorp Vault, or similar
   - Encrypt keys at rest
   - Never store plaintext keys

2. **User Authorization**:
   - Have users sign a message authorizing automatic execution
   - Store authorization in Firestore
   - Require re-authorization periodically

3. **Alternative Approaches**:
   - **Smart Contract Relay**: Use a smart contract that users pre-approve
   - **Meta-Transactions**: Use a relayer with user signatures
   - **Wallet Integration**: Use WalletConnect or similar for execution confirmation

### Price Monitoring

Currently uses DexScreener API. Consider:
- Rate limiting
- Fallback price sources
- Caching prices to reduce API calls
- WebSocket subscriptions for real-time prices

### Order Execution Flow

1. **Monitor Service** checks prices every 5 minutes
2. When condition met → Order status → `EXECUTING`
3. **Execute Service** runs every 2 minutes
4. Gets fresh quote from 0x Protocol
5. Executes swap (currently marked as `PENDING_EXECUTION`)
6. Updates order with transaction hash

### Gas Optimization

- Batch multiple orders when possible
- Use gas-efficient execution times
- Consider layer 2 solutions

## API Endpoints

### Create Order
```
POST /api/orders/create
{
  "walletAddress": "0x...",
  "orderType": "LIMIT_BUY",
  "tokenIn": "ETH",
  "tokenOut": "USDC",
  "tokenInAddress": "0x...",
  "tokenOutAddress": "0x...",
  "amountIn": "0.1",
  "targetPrice": "2.5",
  "slippage": 0.5,
  "goodTillCancel": true
}
```

### List Orders
```
GET /api/orders/list?walletAddress=0x...&status=PENDING
```

### Cancel Order
```
POST /api/orders/cancel
{
  "orderId": "...",
  "walletAddress": "0x..."
}
```

## Firestore Schema

Collection: `limit_orders`

```typescript
{
  walletAddress: string;
  orderType: "LIMIT_BUY" | "LIMIT_SELL" | "STOP_LOSS" | "STOP_LIMIT";
  tokenIn: string;
  tokenOut: string;
  tokenInAddress: string;
  tokenOutAddress: string;
  amountIn: string;
  targetPrice?: number;
  stopPrice?: number;
  limitPrice?: number;
  slippage: number;
  status: "PENDING" | "EXECUTING" | "EXECUTED" | "CANCELLED" | "EXPIRED" | "FAILED";
  createdAt: Timestamp;
  expiresAt?: number;
  transactionHash?: string;
  metadata: {
    currentPrice?: number;
    priceHistory: Array<{price: number, timestamp: number}>;
  }
}
```

## Next Steps

1. ✅ Order creation and storage
2. ✅ Price monitoring service
3. ⚠️ **TODO**: Implement secure private key management
4. ⚠️ **TODO**: Complete order execution with actual swap
5. ⚠️ **TODO**: Add order notifications (email/push)
6. ⚠️ **TODO**: Add order history and analytics
7. ⚠️ **TODO**: Implement partial fills
8. ⚠️ **TODO**: Add order expiration cleanup

## Testing

1. Create a test limit order
2. Manually trigger monitor endpoint: `POST /api/orders/monitor`
3. Check order status updates
4. Test order cancellation
5. Test expiration

## Security Notes

- Orders are scoped to wallet addresses
- Users can only cancel their own orders
- Cron endpoints protected with `CRON_SECRET`
- Firestore rules enforce proper access control











