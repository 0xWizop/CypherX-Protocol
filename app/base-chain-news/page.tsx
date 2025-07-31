"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  EyeIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  UserIcon,
  TrophyIcon,
  FireIcon,
  ClockIcon,
  HeartIcon,
  HandThumbDownIcon,
  PaperAirplaneIcon
} from "@heroicons/react/24/outline";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { 
  fetchUserStats, 
  fetchLeaderboard, 
  interactWithArticle, 
  POINTS_SYSTEM 
} from "@/lib/news-api";
import { useAuth } from "@/app/providers";
import { useAccount } from "wagmi";
import Image from 'next/image';
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

// ────────── Types ──────────
// Firebase timestamp type
interface FirebaseTimestamp {
  toDate(): Date;
  seconds: number;
  nanoseconds: number;
}

interface NewsArticle {
  id?: string;
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: FirebaseTimestamp | string | Date | unknown; // Firebase timestamp
  slug: string;
  category?: string;
  views?: number;
  upvotes?: number;
  downvotes?: number;
  comments?: string[];
  updatedAt?: string;
  thumbnail?: string;
  excerpt?: string;
}

interface UserActivity {
  userId: string;
  walletAddress: string;
  action: string;
  points: number;
  articleSlug?: string;
  createdAt: string;
}

interface LeaderboardEntry {
  walletAddress: string;
  points: number;
  rank?: number;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

// ────────── Utility Functions ──────────
const truncateAtWord = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  return truncated.substring(0, truncated.lastIndexOf(' ')) + '...';
};

const formatDate = (timestamp: unknown): string => {
  if (!timestamp) return 'Unknown date';
  
  let date: Date;
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    // Firebase timestamp
    date = timestamp.toDate();
  } else if (typeof timestamp === 'string') {
    // ISO string
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    // Already a Date object
    date = timestamp;
  } else {
    // Fallback
    date = new Date(String(timestamp));
  }
  
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return 'Yesterday';
  return date.toLocaleDateString();
};



export default function NewsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { address: walletAddress } = useAccount();

  // ────────── State Management ──────────
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [featuredArticle, setFeaturedArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'upvotes'>('date');
  const [userPoints, setUserPoints] = useState(0);
  const [likedArticles, setLikedArticles] = useState<string[]>([]);
  const [dislikedArticles, setDislikedArticles] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recentActivities, setRecentActivities] = useState<UserActivity[]>([]);
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // ────────── Refs ──────────
  const searchRef = useRef<HTMLInputElement>(null);

  // ────────── Fetch Articles from Firebase ──────────
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        
        // Fetch articles from Firebase
        const articlesRef = collection(db, 'articles');
        const q = query(articlesRef, orderBy('publishedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const fetchedArticles: NewsArticle[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedArticles.push({
            id: doc.id,
            title: data.title || '',
            content: data.content || '',
            author: data.author || '',
            source: data.source || '',
            publishedAt: data.publishedAt,
            slug: data.slug || '',
            category: data.category || 'General',
            views: data.views || 0,
            upvotes: data.upvotes || 0,
            downvotes: data.downvotes || 0,
            comments: data.comments || [],
            updatedAt: data.updatedAt || '',
            thumbnail: data.thumbnail || '',
            excerpt: data.excerpt || truncateAtWord(data.content || '', 200)
          });
        });

        setArticles(fetchedArticles);
        
        // Set featured article (most recent or most viewed)
        if (fetchedArticles.length > 0) {
          const featured = fetchedArticles.reduce((prev, current) => 
            (current.views || 0) > (prev.views || 0) ? current : prev
          );
          setFeaturedArticle(featured);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching articles:', error);
        setLoading(false);
        addToast('Error loading articles', 'error');
      }
    };

    fetchArticles();
  }, []);

  // ────────── Fetch User Data ──────────
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user || !walletAddress) return;

      try {
        // Fetch user stats
        const userStats = await fetchUserStats(walletAddress);
        setUserPoints(userStats.stats.points);
        setLikedArticles(userStats.user?.likedArticles || []);
        setDislikedArticles(userStats.user?.dislikedArticles || []);
        setRecentActivities(userStats.activities);

        // Fetch leaderboard
        const leaderboardData = await fetchLeaderboard(10);
        setLeaderboard(leaderboardData.leaderboard);
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [user, walletAddress]);

  // ────────── Event Handlers ──────────
  const handleArticleClick = async (slug: string) => {
    try {
      // Track activity and increment views
      if (user && walletAddress) {
        await interactWithArticle(slug, 'view', user.uid, walletAddress);
        addToast(`Article viewed! +${POINTS_SYSTEM.READ_ARTICLE} points`, 'success');
      }
      router.push(`/base-chain-news/${slug}`);
    } catch (error) {
      console.error('Error handling article click:', error);
    }
  };

  const toggleLike = async (article: NewsArticle) => {
    if (!user || !walletAddress) {
      addToast('Please connect your wallet to like articles', 'error');
      return;
    }

    try {
      const isLiked = likedArticles.includes(article.slug);
      const isDisliked = dislikedArticles.includes(article.slug);
      
      if (isLiked) {
        // Unlike
        await interactWithArticle(article.slug, 'like', user.uid, walletAddress);
        setLikedArticles(prev => prev.filter(slug => slug !== article.slug));
        // Update article upvotes locally
        setArticles(prev => prev.map(a => 
          a.slug === article.slug 
            ? { ...a, upvotes: (a.upvotes || 0) - 1 }
            : a
        ));
      } else {
        // Like - remove dislike if exists
        if (isDisliked) {
          setDislikedArticles(prev => prev.filter(slug => slug !== article.slug));
          setArticles(prev => prev.map(a => 
            a.slug === article.slug 
              ? { ...a, downvotes: (a.downvotes || 0) - 1 }
              : a
          ));
        }
        
        const result = await interactWithArticle(article.slug, 'like', user.uid, walletAddress);
        setLikedArticles(prev => [...prev, article.slug]);
        // Update article upvotes locally
        setArticles(prev => prev.map(a => 
          a.slug === article.slug 
            ? { ...a, upvotes: (a.upvotes || 0) + 1 }
            : a
        ));
        
        if (result.pointsEarned > 0) {
          addToast(`Article liked! +${result.pointsEarned} points`, 'success');
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      addToast('Error liking article', 'error');
    }
  };

  const toggleDislike = async (article: NewsArticle) => {
    if (!user || !walletAddress) {
      addToast('Please connect your wallet to dislike articles', 'error');
      return;
    }

    try {
      const isDisliked = dislikedArticles.includes(article.slug);
      const isLiked = likedArticles.includes(article.slug);
      
      if (isDisliked) {
        // Remove dislike
        setDislikedArticles(prev => prev.filter(slug => slug !== article.slug));
        // Update article downvotes locally
        setArticles(prev => prev.map(a => 
          a.slug === article.slug 
            ? { ...a, downvotes: (a.downvotes || 0) - 1 }
            : a
        ));
      } else {
        // Add dislike - remove like if exists
        if (isLiked) {
          setLikedArticles(prev => prev.filter(slug => slug !== article.slug));
          setArticles(prev => prev.map(a => 
            a.slug === article.slug 
              ? { ...a, upvotes: (a.upvotes || 0) - 1 }
              : a
          ));
        }
        
        await interactWithArticle(article.slug, 'dislike', user.uid, walletAddress);
        setDislikedArticles(prev => [...prev, article.slug]);
        // Update article downvotes locally
        setArticles(prev => prev.map(a => 
          a.slug === article.slug 
            ? { ...a, downvotes: (a.downvotes || 0) + 1 }
            : a
        ));
      }
    } catch (error) {
      console.error('Error toggling dislike:', error);
    }
  };

  const shareArticle = async (article: NewsArticle, platform: 'x' | 'telegram') => {
    const url = `${window.location.origin}/base-chain-news/${article.slug}`;
    const text = `Check out this article: ${article.title}`;
    
    if (platform === 'x') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
    } else {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    }
    
    // Track sharing activity
    if (user && walletAddress) {
      try {
        const result = await interactWithArticle(article.slug, 'share', user.uid, walletAddress, platform);
        addToast(`Shared to ${platform === 'x' ? 'X' : 'Telegram'}! +${result.pointsEarned} points`, 'success');
      } catch (error) {
        console.error('Error tracking share:', error);
      }
    }
  };

  const sendComment = async (slug: string) => {
    if (!user || !walletAddress) {
      addToast('Please connect your wallet to comment', 'error');
      return;
    }

    const comment = newComments[slug];
    if (!comment?.trim()) return;

    try {
      const result = await interactWithArticle(slug, 'comment', user.uid, walletAddress, undefined, comment);
      
      // Update article comments locally
      setArticles(prev => prev.map(a => 
        a.slug === slug 
          ? { ...a, comments: [...(a.comments || []), comment] }
          : a
      ));
      
      setNewComments(prev => ({ ...prev, [slug]: '' }));
      addToast(`Comment sent! +${result.pointsEarned} points`, 'success');
    } catch (error) {
      console.error('Error sending comment:', error);
      addToast('Error sending comment', 'error');
    }
  };

  const addToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  // ────────── Filtered Articles ──────────
  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !filterCategory || article.category === filterCategory;
    const matchesAuthor = !filterAuthor || article.author === filterAuthor;
    
    return matchesSearch && matchesCategory && matchesAuthor;
  });

  const sortedArticles = [...filteredArticles].sort((a, b) => {
    switch (sortBy) {
      case 'views':
        return (b.views || 0) - (a.views || 0);
      case 'upvotes':
        return (b.upvotes || 0) - (a.upvotes || 0);
      default:
        // Sort by publishedAt timestamp
        const getDate = (timestamp: FirebaseTimestamp | string | Date | unknown): Date => {
          if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
            return (timestamp as FirebaseTimestamp).toDate();
          } else if (typeof timestamp === 'string') {
            return new Date(timestamp);
          } else if (timestamp instanceof Date) {
            return timestamp;
          } else {
            return new Date(0);
          }
        };
        const dateA = getDate(a.publishedAt);
        const dateB = getDate(b.publishedAt);
        return dateB.getTime() - dateA.getTime();
    }
  });

  const categories = Array.from(new Set(articles.map(article => article.category).filter(Boolean)));
  const authors = Array.from(new Set(articles.map(article => article.author)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Header />
      
      {/* Toast Notifications */}
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
              toast.type === 'success' ? 'bg-green-500/90 text-white' :
              toast.type === 'error' ? 'bg-red-500/90 text-white' :
              'bg-blue-500/90 text-white'
            }`}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
            Base Chain News
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Stay updated with the latest developments, protocols, and insights from the Base ecosystem
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white hover:bg-gray-700/50 transition-colors"
            >
              <FunnelIcon className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>

                  <select
                    value={filterAuthor}
                    onChange={(e) => setFilterAuthor(e.target.value)}
                    className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Authors</option>
                    {authors.map(author => (
                      <option key={author} value={author}>{author}</option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'views' | 'upvotes')}
                    className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="date">Sort by Date</option>
                    <option value="views">Sort by Views</option>
                    <option value="upvotes">Sort by Upvotes</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="text-gray-400 mt-4">Loading articles...</p>
          </motion.div>
        )}

        {/* Content */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3">
              {/* Featured Article */}
              {featuredArticle && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
                  <div className="bg-gray-800/30 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors">
                    {featuredArticle.thumbnail && (
                      <div className="relative h-64 sm:h-80">
                        <Image
                          src={featuredArticle.thumbnail}
                          alt={featuredArticle.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-4 left-4">
                          <span className="inline-block px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
                            Featured
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                          {featuredArticle.category}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {formatDate(featuredArticle.publishedAt)}
                        </span>
                      </div>
                      
                      <h2 className="text-2xl font-bold text-white mb-3">
                        {featuredArticle.title}
                      </h2>
                      
                      <p className="text-gray-300 mb-4">
                        {featuredArticle.excerpt || truncateAtWord(featuredArticle.content, 200)}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 text-sm">{featuredArticle.author}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <EyeIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 text-sm">{featuredArticle.views?.toLocaleString()}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleArticleClick(featuredArticle.slug)}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 font-medium shadow-lg hover:shadow-xl"
                          >
                            Read Article →
                          </button>
                        </div>
                      </div>

                      {/* Article Actions */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => toggleLike(featuredArticle)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                              likedArticles.includes(featuredArticle.slug)
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-transparent'
                            }`}
                          >
                            <HeartIcon className={`w-4 h-4 transition-all duration-200 ${
                              likedArticles.includes(featuredArticle.slug) ? 'fill-current' : ''
                            }`} />
                            <span>{featuredArticle.upvotes || 0}</span>
                          </button>
                          
                          <button
                            onClick={() => toggleDislike(featuredArticle)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                              dislikedArticles.includes(featuredArticle.slug)
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-transparent'
                            }`}
                          >
                            <HandThumbDownIcon className={`w-4 h-4 transition-all duration-200 ${
                              dislikedArticles.includes(featuredArticle.slug) ? 'fill-current' : ''
                            }`} />
                            <span>{featuredArticle.downvotes || 0}</span>
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => shareArticle(featuredArticle, 'x')}
                            className="px-3 py-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600/50 transition-all duration-200 transform hover:scale-105"
                          >
                            Share X
                          </button>
                          <button
                            onClick={() => shareArticle(featuredArticle, 'telegram')}
                            className="px-3 py-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600/50 transition-all duration-200 transform hover:scale-105"
                          >
                            Share TG
                          </button>
                        </div>
                      </div>

                      {/* Comments Section */}
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="relative mb-3">
                          <textarea
                            placeholder="Add a comment..."
                            value={newComments[featuredArticle.slug] || ""}
                            onChange={(e) => setNewComments(prev => ({ ...prev, [featuredArticle.slug]: e.target.value }))}
                            className="w-full px-3 py-2 pr-12 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={2}
                          />
                          <button
                            onClick={() => sendComment(featuredArticle.slug)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-md hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105"
                          >
                            <PaperAirplaneIcon className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {featuredArticle.comments && featuredArticle.comments.length > 0 && (
                          <div className="space-y-2">
                            {featuredArticle.comments.map((comment, index) => (
                              <div key={index} className="p-3 bg-gray-700/30 rounded-lg">
                                <p className="text-gray-300 text-sm">{comment}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Articles Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sortedArticles.slice(1).map((article, index) => (
                  <motion.div
                    key={article.slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="bg-gray-800/30 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    {article.thumbnail && (
                      <div className="relative h-48">
                        <Image
                          src={article.thumbnail}
                          alt={article.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      </div>
                    )}
                    
                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                          {article.category}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {formatDate(article.publishedAt)}
                        </span>
                      </div>
                      
                      <h3 className="text-xl font-bold text-white mb-3 line-clamp-2">
                        {article.title}
                      </h3>
                      
                      <p className="text-gray-300 mb-4 line-clamp-3">
                        {article.excerpt || truncateAtWord(article.content, 150)}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 text-sm">{article.author}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <EyeIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 text-sm">{article.views?.toLocaleString()}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleArticleClick(article.slug)}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 font-medium shadow-lg hover:shadow-xl"
                          >
                            Read Article →
                          </button>
                        </div>
                      </div>

                      {/* Article Actions */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => toggleLike(article)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                              likedArticles.includes(article.slug)
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-transparent'
                            }`}
                          >
                            <HeartIcon className={`w-4 h-4 transition-all duration-200 ${
                              likedArticles.includes(article.slug) ? 'fill-current' : ''
                            }`} />
                            <span>{article.upvotes || 0}</span>
                          </button>
                          
                          <button
                            onClick={() => toggleDislike(article)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                              dislikedArticles.includes(article.slug)
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-transparent'
                            }`}
                          >
                            <HandThumbDownIcon className={`w-4 h-4 transition-all duration-200 ${
                              dislikedArticles.includes(article.slug) ? 'fill-current' : ''
                            }`} />
                            <span>{article.downvotes || 0}</span>
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => shareArticle(article, 'x')}
                            className="px-3 py-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600/50 transition-all duration-200 transform hover:scale-105"
                          >
                            Share X
                          </button>
                          <button
                            onClick={() => shareArticle(article, 'telegram')}
                            className="px-3 py-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600/50 transition-all duration-200 transform hover:scale-105"
                          >
                            Share TG
                          </button>
                        </div>
                      </div>

                      {/* Comments Section */}
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="relative mb-3">
                          <textarea
                            placeholder="Add a comment..."
                            value={newComments[article.slug] || ""}
                            onChange={(e) => setNewComments(prev => ({ ...prev, [article.slug]: e.target.value }))}
                            className="w-full px-3 py-2 pr-12 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={2}
                          />
                          <button
                            onClick={() => sendComment(article.slug)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-md hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105"
                          >
                            <PaperAirplaneIcon className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {article.comments && article.comments.length > 0 && (
                          <div className="space-y-2">
                            {article.comments.map((comment, index) => (
                              <div key={index} className="p-3 bg-gray-700/30 rounded-lg">
                                <p className="text-gray-300 text-sm">{comment}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="space-y-6">
                {/* Become an Author CTA */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl p-6 border border-purple-500/30"
                >
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-purple-400" />
                    Become an Author
                  </h3>
                  <p className="text-gray-300 text-sm mb-4">
                    Share your insights about Base Chain and earn rewards. Join our community of writers!
                  </p>
                  <button className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200 transform hover:scale-105 font-medium">
                    Apply Now
                  </button>
                </motion.div>

                {/* Ad Placement */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                  className="bg-gray-800/30 rounded-xl p-6 border border-gray-700 min-h-[200px] flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-700/50 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <span className="text-gray-400 text-2xl">📢</span>
                    </div>
                    <p className="text-gray-400 text-sm">Advertisement Space</p>
                    <p className="text-gray-500 text-xs mt-1">300x250</p>
                  </div>
                </motion.div>

                {/* User Stats */}
                {user && walletAddress && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-gray-800/30 rounded-xl p-6 border border-gray-700"
                  >
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <TrophyIcon className="w-5 h-5 text-yellow-400" />
                      Your Stats
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Points</span>
                        <span className="text-white font-bold">{userPoints.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Liked Articles</span>
                        <span className="text-white">{likedArticles.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Rank</span>
                        <span className="text-white">#{leaderboard.find(entry => entry.walletAddress === walletAddress)?.rank || 'N/A'}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Leaderboard */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-gray-800/30 rounded-xl p-6 border border-gray-700"
                >
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <FireIcon className="w-5 h-5 text-orange-400" />
                    Leaderboard
                  </h3>
                  
                  <div className="space-y-3">
                    {leaderboard.slice(0, 5).map((entry, index) => (
                      <div key={entry.walletAddress} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-yellow-500 text-black' :
                            index === 1 ? 'bg-gray-400 text-black' :
                            index === 2 ? 'bg-orange-500 text-white' :
                            'bg-gray-600 text-white'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-gray-300 text-sm">
                            {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}
                          </span>
                        </div>
                        <span className="text-white font-bold">{entry.points.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Recent Activity */}
                {recentActivities.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-gray-800/30 rounded-xl p-6 border border-gray-700"
                  >
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <ClockIcon className="w-5 h-5 text-blue-400" />
                      Recent Activity
                    </h3>
                    
                    <div className="space-y-3">
                      {recentActivities.slice(0, 3).map((activity, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-gray-300 text-sm">
                            {activity.action.replace('_', ' ')}
                          </span>
                          <span className="text-green-400 text-sm font-bold">
                            +{activity.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}