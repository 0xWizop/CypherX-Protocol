/**
 * Firestore Type Definitions
 * 
 * Type definitions for Orders, Positions, and Wallet Tracking collections
 */

import { Timestamp } from 'firebase-admin/firestore';

// ============================================================================
// WALLET ORDERS
// ============================================================================

export interface WalletOrder {
  id?: string; // Document ID
  walletAddress: string; // Wallet that created the order
  userId?: string; // Optional: Firebase Auth user ID if linked
  
  // Order Details
  type: 'BUY' | 'SELL' | 'SWAP';
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'FAILED' | 'PARTIALLY_FILLED';
  
  // Token Information
  tokenAddress: string; // Token being traded
  tokenSymbol?: string;
  tokenName?: string;
  
  // Amount Information
  amount: string; // Amount in token units (wei for ETH, raw units for tokens)
  amountDisplay?: string; // Human-readable amount
  inputToken?: string; // For swaps: input token address
  outputToken?: string; // For swaps: output token address
  
  // Price Information
  price?: string; // Price per token (if limit order)
  priceType?: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  slippageTolerance?: number; // Slippage tolerance percentage
  
  // Execution Information
  executedAt?: Timestamp | Date;
  executedPrice?: string;
  executedAmount?: string;
  txHash?: string; // Transaction hash if executed
  
  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  timestamp: Timestamp | Date; // For sorting/indexing
  
  // Metadata
  metadata?: {
    protocol?: string; // e.g., '0x', 'Uniswap', '1inch'
    aggregator?: string;
    route?: any; // Swap route information
    gasEstimate?: string;
    [key: string]: any;
  };
}

// ============================================================================
// WALLET POSITIONS
// ============================================================================

export interface WalletPosition {
  id?: string; // Document ID
  walletAddress: string; // Wallet that holds the position
  userId?: string; // Optional: Firebase Auth user ID if linked
  
  // Token Information
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  
  // Position Details
  amount: string; // Current position size (in token units)
  entryPrice: string; // Average entry price
  currentPrice?: string; // Current market price
  lastPriceUpdate?: Timestamp | Date;
  
  // PnL Information
  unrealizedPnL?: string; // Unrealized profit/loss in USD
  realizedPnL?: string; // Realized profit/loss in USD
  totalPnL?: string; // Total profit/loss
  
  // Position Status
  isOpen: boolean;
  openedAt: Timestamp | Date;
  closedAt?: Timestamp | Date;
  
  // Trade History
  buyCount?: number; // Number of buy trades
  sellCount?: number; // Number of sell trades
  totalVolume?: string; // Total volume traded
  
  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  
  // Metadata
  metadata?: {
    firstBuy?: Timestamp | Date;
    lastTrade?: Timestamp | Date;
    [key: string]: any;
  };
}

// ============================================================================
// WALLET TRANSACTIONS
// ============================================================================

export interface WalletTransaction {
  id?: string; // Document ID
  walletAddress: string; // Wallet that made the transaction
  userId?: string; // Optional: Firebase Auth user ID if linked
  
  // Transaction Details
  type: 'BUY' | 'SELL' | 'SWAP' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'APPROVAL' | 'OTHER';
  txHash: string; // Blockchain transaction hash
  blockNumber?: number;
  blockTimestamp?: Timestamp | Date;
  
  // Token Information
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  inputToken?: string; // For swaps
  outputToken?: string; // For swaps
  
  // Amount Information
  amount: string; // Token amount
  amountDisplay?: string; // Human-readable amount
  valueUsd?: string; // USD value at time of transaction
  
  // Price Information
  price?: string; // Price per token
  gasUsed?: string;
  gasPrice?: string;
  gasCostUsd?: string;
  
  // Status
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  confirmations?: number;
  
  // Timestamps
  timestamp: Timestamp | Date;
  createdAt: Timestamp | Date;
  
  // Metadata
  metadata?: {
    protocol?: string;
    aggregator?: string;
    from?: string; // For transfers
    to?: string; // For transfers
    [key: string]: any;
  };
}

// ============================================================================
// USER WALLET DATA
// ============================================================================

export interface UserWalletData {
  id?: string; // Document ID
  userId: string; // Firebase Auth user ID
  walletAddress: string; // Linked wallet address
  
  // Wallet Status
  isPrimary: boolean; // Primary wallet for the user
  isVerified: boolean; // Whether wallet ownership is verified
  verifiedAt?: Timestamp | Date;
  
  // Verification Method
  verificationMethod?: 'SIGNATURE' | 'TRANSACTION' | 'MANUAL';
  verificationProof?: string; // Proof of ownership (signature, tx hash, etc.)
  
  // Linkage Information
  linkedAt: Timestamp | Date;
  unlinkedAt?: Timestamp | Date;
  isActive: boolean;
  
  // Wallet Metadata
  walletType?: 'EOA' | 'CONTRACT' | 'MULTISIG';
  network?: string; // e.g., 'base', 'ethereum', 'optimism'
  label?: string; // User-defined label
  notes?: string; // User notes
  
  // Statistics (computed/updated)
  totalTrades?: number;
  totalVolume?: string;
  lastActivityAt?: Timestamp | Date;
  
  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  
  // Metadata
  metadata?: {
    [key: string]: any;
  };
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type OrderStatus = WalletOrder['status'];
export type OrderType = WalletOrder['type'];
export type TransactionType = WalletTransaction['type'];

// Query filter types
export interface OrderFilters {
  walletAddress?: string;
  userId?: string;
  status?: OrderStatus | OrderStatus[];
  type?: OrderType | OrderType[];
  tokenAddress?: string;
  startDate?: Timestamp | Date;
  endDate?: Timestamp | Date;
}

export interface PositionFilters {
  walletAddress?: string;
  userId?: string;
  tokenAddress?: string;
  isOpen?: boolean;
}

export interface TransactionFilters {
  walletAddress?: string;
  userId?: string;
  type?: TransactionType | TransactionType[];
  tokenAddress?: string;
  startDate?: Timestamp | Date;
  endDate?: Timestamp | Date;
  status?: WalletTransaction['status'];
}

// ============================================================================
// PREDICTION POOLS (Gasless Alpha Drops)
// ============================================================================

export interface PredictionPool {
  id?: string; // Document ID
  creatorId?: string; // Optional: User who created the pool
  creatorAddress?: string; // Wallet address of creator
  
  // Prediction Details
  tokenAddress: string; // Base token being predicted on
  tokenSymbol?: string;
  tokenName?: string;
  predictionType: 'PUMP' | 'DUMP'; // Will price go up or down
  threshold: number; // Percentage threshold (e.g., 15 for 15%)
  timeframe: number; // Duration in minutes (5-60)
  
  // Pool Status
  status: 'ACTIVE' | 'RESOLVING' | 'RESOLVED' | 'CANCELLED';
  
  // Timing
  startTime: Timestamp | Date; // When pool started
  endTime: Timestamp | Date; // When pool expires
  resolvedAt?: Timestamp | Date;
  
  // Price Tracking
  startPrice: number; // Token price at pool start (USD)
  endPrice?: number; // Token price at pool end (USD)
  priceSource?: string; // e.g., 'dexscreener', 'coingecko'
  
  // Participants
  participants: PredictionParticipant[]; // Array of participants
  totalStaked: number; // Total amount staked (USD)
  winnerCount: number; // Number of winners
  loserCount: number; // Number of losers
  
  // Payouts
  totalPot: number; // Total pot to split among winners (USD)
  gasFeePool: number; // Amount reserved for gas fees (USD)
  winnerPayout?: number; // Amount each winner gets (USD)
  
  // Execution
  autoExecuteTrades: boolean; // Whether to auto-execute trades for winners
  executedTrades?: string[]; // Array of transaction hashes for executed trades
  executionStatus?: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  
  // Metadata
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  
  metadata?: {
    description?: string;
    [key: string]: any;
  };
}

export interface PredictionParticipant {
  userId?: string; // Optional: Firebase Auth user ID
  walletAddress: string; // Participant wallet
  stakeAmount: number; // Amount staked (USD)
  prediction: 'YES' | 'NO'; // Their prediction
  isWinner?: boolean; // Whether they won
  payout?: number; // Amount they received (USD)
  tradeExecuted?: boolean; // Whether their trade was executed
  tradeTxHash?: string; // Transaction hash if trade executed
  joinedAt: Timestamp | Date;
}




















































