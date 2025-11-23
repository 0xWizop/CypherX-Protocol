'use client';

import React, { useState } from 'react';
import { ShoppingBagIcon, SparklesIcon, UserIcon, RocketLaunchIcon, MegaphoneIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useWalletSystem } from '@/app/providers';
import toast from 'react-hot-toast';

// Define MarketplaceItem type directly (to avoid path issues)
interface MarketplaceItem {
  id?: string;
  name: string;
  description: string;
  price?: string;
  category?: string;
  available?: boolean;
  icon?: string;
}

interface IconMap {
  Advertisement: typeof ShoppingBagIcon;
  TokenBoost: typeof SparklesIcon;
  ExplorerProfile: typeof UserIcon;
  'Bump Bot': typeof RocketLaunchIcon;
  Telegram: typeof MegaphoneIcon;
}

// Animation variants for cards
const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  // Use a typed-friendly transition (omit `ease` to satisfy framer-motion TS types)
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const ClientCard = ({ item, isComingSoon = false }: { item: MarketplaceItem; isComingSoon?: boolean }) => {
  const icons: IconMap = {
    Advertisement: ShoppingBagIcon,
    TokenBoost: SparklesIcon,
    ExplorerProfile: UserIcon,
    'Bump Bot': RocketLaunchIcon,
    Telegram: MegaphoneIcon,
  };

  // Safely determine the icon key with a fallback
  const iconKey = item.category || (item.name.includes('Bump Bot') ? 'Bump Bot' : 'Telegram');
  const Icon = icons[iconKey as keyof IconMap]; // Type assertion to ensure key is valid

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showPrice, setShowPrice] = useState(true);

  const { selfCustodialWallet } = useWalletSystem();
  const isConnected = !!selfCustodialWallet?.isConnected;

  const handlePurchase = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet to make a purchase');
      return;
    }

    setIsPurchasing(true);

    try {
      // This part of the logic needs to be adapted if wagmi is removed
      // For now, it will just show a toast message
      toast.success(`Simulated purchase of "${item.name}" for ${item.price}.`);
      setIsPurchasing(false);
      setShowModal(true);
    } catch (err) {
      toast.error('Failed to initiate transaction. Please try again or contact support.');
      setIsPurchasing(false);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setTxHash(null);
  };

  const togglePriceVisibility = () => {
    setShowPrice(!showPrice);
  };

  const getDisplayPrice = () => {
    if (!item.price) return '';
    if (showPrice) return item.price;
    return '*'.repeat(item.price.length);
  };

  return (
    <>
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-gray-900 p-6 rounded-lg border border-blue-500/20 relative shadow-lg hover:shadow-[0_0_8px_rgba(37,99,235,0.2)] transition-all duration-300 group"
      >
        {/* Badge */}
        <span
          className={`absolute top-4 right-4 px-2 py-1 rounded-full text-xs uppercase ${
            isComingSoon ? 'bg-gray-700 text-gray-400' : 'bg-blue-500/20 text-blue-400'
          }`}
        >
          {isComingSoon ? 'Coming Soon' : 'Available'}
        </span>
        <div className="flex items-center mb-3">
          <Icon className="h-6 w-6 text-blue-400 mr-3" />
          <h3 className="text-lg font-semibold text-white uppercase">{item.name}</h3>
        </div>
        <p className="text-gray-400 text-sm mb-4 group-hover:text-gray-300 transition-colors duration-300">
          {item.description}
        </p>
        <div>
          {item.price && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-2xl font-bold text-white">
                {getDisplayPrice()}
              </p>
              <button
                onClick={togglePriceVisibility}
                className="p-2 text-gray-400 hover:text-gray-300 transition-colors duration-200"
                title={showPrice ? "Hide price" : "Show price"}
              >
                {showPrice ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          )}
          <button
            onClick={handlePurchase}
            disabled={isPurchasing || !item.available} // Removed wagmi/wagmi-specific checks
            className={`w-full py-2 rounded-lg text-sm font-medium uppercase transition-all duration-300 ${
              item.available && !isPurchasing
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 border border-blue-500/30'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
            }`}
          >
            {isPurchasing
              ? 'Processing...'
              : item.available
              ? 'Buy Now'
              : 'Coming Soon'}
          </button>
        </div>
      </motion.div>

      {/* Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Transaction Complete</h3>
            <p className="text-gray-300 mb-4">
              Your purchase of "{item.name}" has been completed successfully!
            </p>
            {txHash && (
              <p className="text-sm text-gray-400 mb-4">
                Transaction Hash: {txHash.slice(0, 6)}...{txHash.slice(-4)}
              </p>
            )}
            <button
              onClick={handleModalClose}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientCard;