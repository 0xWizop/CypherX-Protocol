"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiTrendingUp, FiTrendingDown, FiClock } from "react-icons/fi";
import { HiOutlineSparkles } from "react-icons/hi";

interface Transaction {
  id: string;
  action: string;
  points: number;
  articleSlug?: string;
  commentId?: string;
  metadata?: any;
  createdAt: string;
}

interface PointsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

const PointsHistoryModal: React.FC<PointsHistoryModalProps> = ({
  isOpen,
  onClose,
  walletAddress
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'earned' | 'spent'>('all');
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalSpent: 0,
    netPoints: 0,
    todayEarned: 0,
    todaySpent: 0
  });
  const [dailyLimits, setDailyLimits] = useState<{[key: string]: {current: number, limit: number}}>({});

  // Fetch transaction history
  useEffect(() => {
    if (!isOpen || !walletAddress) return;

    const fetchTransactions = async () => {
      setLoading(true);
      try {
        console.log('Fetching transactions for walletAddress:', walletAddress);
        const response = await fetch(`/api/user/transactions?userId=${walletAddress}`);
        console.log('Response status:', response.status);
        
                 if (response.ok) {
           const data = await response.json();
           console.log('Transactions data:', data);
           setTransactions(data.transactions || []);
           setStats(data.stats || {
             totalEarned: 0,
             totalSpent: 0,
             netPoints: 0,
             todayEarned: 0,
             todaySpent: 0
           });
           setDailyLimits(data.dailyLimits || {});
         } else {
          const errorData = await response.json();
          console.error('API Error:', errorData);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [isOpen, walletAddress]);

  // Filter transactions
  const filteredTransactions = transactions.filter(transaction => {
    console.log('Filtering transaction:', { action: transaction.action, points: transaction.points, filter });
    if (filter === 'earned') return transaction.points > 0;
    if (filter === 'spent') return transaction.points < 0;
    return true;
  });

  // Format action name
  const formatAction = (action: string) => {
    return action.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Get action icon
  const getActionIcon = (action: string) => {
    if (action.includes('like')) return <FiTrendingUp className="w-4 h-4" />;
    if (action.includes('pin')) return <HiOutlineSparkles className="w-4 h-4" />;
    if (action.includes('comment')) return <FiTrendingUp className="w-4 h-4" />;
    if (action.includes('spend')) return <FiTrendingDown className="w-4 h-4" />;
    return <FiClock className="w-4 h-4" />;
  };

  // Get action color
  const getActionColor = (points: number) => {
    if (points > 0) return 'text-green-400';
    if (points < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };



  // Get daily limit indicator
  const getDailyLimitIndicator = (action: string) => {
    const limit = dailyLimits[action];
    if (!limit) return null;
    
    const percentage = (limit.current / limit.limit) * 100;
    const isAtLimit = limit.current >= limit.limit;
    
    return (
      <div className="flex items-center gap-2 mt-1">
        <div className="flex-1 bg-gray-800 h-1.5">
          <div 
            className={`h-1.5 transition-all duration-300 ${
              isAtLimit ? 'bg-red-400' : percentage > 80 ? 'bg-yellow-400' : 'bg-green-400'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <span className={`text-xs ${
          isAtLimit ? 'text-red-400' : percentage > 80 ? 'text-yellow-400' : 'text-green-400'
        }`}>
          {limit.current}/{limit.limit}
        </span>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 sm:flex sm:items-center sm:justify-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="w-full h-full sm:h-auto sm:max-w-2xl sm:border sm:border-gray-800 bg-gray-950 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative bg-gray-950 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 flex items-center justify-center">
                  <FiTrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Points History</h3>
                  <p className="text-sm text-gray-400">Track your earnings and spending</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="absolute top-3 sm:top-4 right-4 sm:right-6 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200"
                aria-label="Close"
              >
                <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

                     {/* Stats Overview */}
           <div className="p-6 bg-gray-900/40 border-b border-gray-800">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="text-center">
                 <p className="text-gray-400 text-xs">Total Earned</p>
                 <p className="text-green-400 font-semibold text-lg">{stats.totalEarned.toLocaleString()}</p>
               </div>
               <div className="text-center">
                 <p className="text-gray-400 text-xs">Total Spent</p>
                 <p className="text-red-400 font-semibold text-lg">{Math.abs(stats.totalSpent).toLocaleString()}</p>
               </div>
               <div className="text-center">
                 <p className="text-gray-400 text-xs">Net Points</p>
                 <p className={`font-semibold text-lg ${stats.netPoints >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                   {stats.netPoints.toLocaleString()}
                 </p>
               </div>
               <div className="text-center">
                 <p className="text-gray-400 text-xs">Today</p>
                 <p className={`font-semibold text-lg ${stats.todayEarned - stats.todaySpent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                   {(stats.todayEarned - stats.todaySpent).toLocaleString()}
                 </p>
               </div>
             </div>
             
             {/* Daily Points Progress */}
             <div className="mt-4 pt-4 border-t border-gray-800">
               <h4 className="text-white font-medium text-sm mb-3">Daily Points Progress</h4>
               <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-gray-400 text-sm">Points Earned Today</span>
                   <div className="flex items-center gap-2">
                     <div className="w-24 bg-gray-800 h-2">
                       <div 
                         className={`h-2 transition-all duration-300 ${
                           stats.todayEarned >= 1000 ? 'bg-red-400' : 
                           stats.todayEarned >= 800 ? 'bg-yellow-400' : 'bg-green-400'
                         }`}
                         style={{ width: `${Math.min((stats.todayEarned / 1000) * 100, 100)}%` }}
                       />
                     </div>
                     <span className={`text-sm font-medium ${
                       stats.todayEarned >= 1000 ? 'text-red-400' : 
                       stats.todayEarned >= 800 ? 'text-yellow-400' : 'text-green-400'
                     }`}>
                       {stats.todayEarned}/1000
                     </span>
                   </div>
                 </div>
                 {stats.todayEarned >= 1000 && (
                   <div className="text-center">
                     <p className="text-red-400 text-xs">Daily points limit reached</p>
                   </div>
                 )}
               </div>
             </div>
           </div>

          {/* Filter Tabs */}
          <div className="px-6 py-4 border-b border-gray-800">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('earned')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === 'earned' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
                }`}
              >
                Earned
              </button>
              <button
                onClick={() => setFilter('spent')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === 'spent' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
                }`}
              >
                Spent
              </button>
            </div>
          </div>

                     {/* Transactions List */}
           <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="text-gray-400 mt-4">Loading transactions...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-8 text-center">
                <FiClock className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No transactions found</p>
                <p className="text-gray-500 text-sm mt-2">Start engaging to see your points history</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {filteredTransactions.map((transaction) => (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 hover:bg-gray-900/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 flex items-center justify-center ${
                          transaction.points > 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          {getActionIcon(transaction.action)}
                        </div>
                                                 <div>
                           <p className="text-white font-medium">{formatAction(transaction.action)}</p>
                           <p className="text-gray-400 text-sm">
                             {transaction.articleSlug && `Article: ${transaction.articleSlug}`}
                             {transaction.metadata?.likedBy && ` • Liked by ${transaction.metadata.likedBy.slice(0, 6)}...`}
                             {transaction.metadata?.pinnedBy && ` • Pinned by ${transaction.metadata.pinnedBy.slice(0, 6)}...`}
                           </p>
                           {getDailyLimitIndicator(transaction.action)}
                         </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${getActionColor(transaction.points)}`}>
                          {transaction.points > 0 ? '+' : ''}{transaction.points} pts
                        </p>
                        <p className="text-gray-500 text-sm">{formatDate(transaction.createdAt)}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PointsHistoryModal;
