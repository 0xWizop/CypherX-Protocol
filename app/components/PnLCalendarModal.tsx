"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiInfo, FiRefreshCw, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { 
  format, 
  eachDayOfInterval, 
  getDay, 
  addMonths,
  isSameMonth, 
  isToday
} from "date-fns";
// Workaround for date-fns v4 type definitions
const dateFns = require("date-fns") as typeof import("date-fns") & {
  startOfMonth: (date: Date | number) => Date;
  endOfMonth: (date: Date | number) => Date;
};
const { startOfMonth, endOfMonth } = dateFns;

interface DailyPnL {
  date: string;
  pnl: number;
}

interface PnLCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

const PnLCalendarModal: React.FC<PnLCalendarModalProps> = ({
  isOpen,
  onClose,
  walletAddress,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [dailyPnL, setDailyPnL] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch P&L data
  const fetchPnLData = async (forceRefresh = false) => {
    if (!walletAddress || !isOpen) return;
    
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(`/api/wallet/pnl?address=${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        // Convert dailyPnL array to a map for easy lookup
        const pnlMap: Record<string, number> = {};
        if (data.dailyPnL && Array.isArray(data.dailyPnL)) {
          data.dailyPnL.forEach((item: DailyPnL) => {
            pnlMap[item.date] = item.pnl;
          });
        }
        setDailyPnL(pnlMap);
      }
    } catch (error) {
      console.error("Error fetching P&L data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen && walletAddress) {
      fetchPnLData();
    }
  }, [isOpen, walletAddress, currentMonth]);

  // Get calendar days for the current month (weekdays only)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    // Get all days in the month
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Filter to only weekdays (Monday = 1, Friday = 5)
    const weekdays = allDays.filter(day => {
      const dayOfWeek = getDay(day);
      return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
    });

    return weekdays;
  }, [currentMonth]);

  // Get previous month days to fill the first week
  const getPreviousMonthDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const firstWeekday = getDay(monthStart);
    const days: Date[] = [];
    
    // If month doesn't start on Monday, add previous month's weekdays
    if (firstWeekday > 1 && firstWeekday <= 5) {
      // Count back to find the last Monday before this month
      let day = new Date(monthStart);
      day.setDate(day.getDate() - 1); // Start from day before month
      
      while (days.length < firstWeekday - 1) {
        const dayOfWeek = getDay(day);
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          days.unshift(new Date(day));
        }
        day.setDate(day.getDate() - 1);
      }
    }
    
    return days;
  };

  // Get next month days to fill the last week
  const getNextMonthDays = () => {
    const monthEnd = endOfMonth(currentMonth);
    const lastWeekday = getDay(monthEnd);
    const days: Date[] = [];
    
    // If month doesn't end on Friday, add next month's weekdays
    if (lastWeekday < 5 && lastWeekday >= 0) {
      const nextMonth = addMonths(currentMonth, 1);
      const nextMonthStart = startOfMonth(nextMonth);
      
      // Count forward to find weekdays to fill the row
      let day = new Date(monthEnd);
      day.setDate(day.getDate() + 1); // Start from day after month
      
      while (days.length < (5 - lastWeekday)) {
        const dayOfWeek = getDay(day);
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          days.push(new Date(day));
        }
        day.setDate(day.getDate() + 1);
        if (day > nextMonthStart) break; // Don't go too far
      }
    }
    
    return days;
  };

  // Format P&L value
  const formatPnL = (value: number | undefined): string => {
    if (value === undefined || value === null) return "--";
    // Show small values (even 0.01) with proper formatting
    if (Math.abs(value) < 0.01 && value !== 0) {
      return value > 0 ? "+0.01" : "-0.01";
    }
    if (value === 0) return "0.00";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
  };

  // Get P&L color
  const getPnLColor = (value: number | undefined): string => {
    if (value === undefined || value === null) return "text-gray-500";
    if (value === 0) return "text-gray-400";
    return value > 0 ? "text-green-400" : "text-red-400";
  };

  // Get P&L background color
  const getPnLBackgroundColor = (value: number | undefined): string => {
    if (value === undefined || value === null) return "bg-gray-900/50";
    if (value === 0) return "bg-gray-900/50";
    return value > 0 ? "bg-green-500/10" : "bg-red-500/10";
  };

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentMonth(addMonths(currentMonth, -1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Get date string in YYYY-MM-DD format (UTC)
  const getDateKey = (date: Date): string => {
    return format(date, "yyyy-MM-dd");
  };

  if (!isOpen) return null;

  const prevDays = getPreviousMonthDays();
  const nextDays = getNextMonthDays();
  const allDays = [...prevDays, ...calendarDays, ...nextDays];
  
  // Group into rows of 5 (weekdays)
  const rows: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 5) {
    rows.push(allDays.slice(i, i + 5));
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[10000] sm:flex sm:items-center sm:justify-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-gray-950 sm:border sm:border-gray-800 shadow-2xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800 bg-gray-950">
                <div className="flex items-center gap-3">
                  <h2 className="text-white text-xl sm:text-2xl font-semibold">P&L Calendar</h2>
                  <button
                    onClick={() => fetchPnLData(true)}
                    disabled={refreshing}
                    className="p-1.5 hover:bg-gray-900 transition-colors disabled:opacity-50"
                    title="Refresh"
                  >
                    <FiRefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    className="p-1.5 hover:bg-gray-900 transition-colors"
                    title="Information"
                  >
                    <FiInfo className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <button
                  onClick={onClose}
                  className="absolute top-3 sm:top-4 right-4 sm:right-6 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200"
                  aria-label="Close"
                >
                  <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-4 sm:px-6 pt-4 pb-0">
                <div className="flex items-center gap-2 border-b border-gray-800">
                  <button
                    onClick={() => setViewMode("month")}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                      viewMode === "month"
                        ? "text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Month
                    {viewMode === "month" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                    )}
                  </button>
                  <button
                    onClick={() => setViewMode("year")}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                      viewMode === "year"
                        ? "text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Year
                    {viewMode === "year" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                    )}
                  </button>
                </div>
              </div>

              {/* Month Navigation */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-gray-950">
                <button
                  onClick={goToPreviousMonth}
                  className="p-2 hover:bg-gray-900 transition-colors"
                >
                  <FiChevronLeft className="w-5 h-5 text-gray-400" />
                </button>
                <h3 className="text-white text-lg font-semibold">
                  {format(currentMonth, "MMMM yyyy")}
                </h3>
                <button
                  onClick={goToNextMonth}
                  className="p-2 hover:bg-gray-900 transition-colors"
                >
                  <FiChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-5 gap-2 mb-2">
                      {["MON", "TUE", "WED", "THU", "FRI"].map((day) => (
                        <div
                          key={day}
                          className="text-center text-xs sm:text-sm font-medium text-gray-400 py-2"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    {rows.map((row, rowIndex) => (
                      <div key={rowIndex} className="grid grid-cols-5 gap-2">
                        {row.map((day) => {
                          const dateKey = getDateKey(day);
                          const pnlValue = dailyPnL[dateKey];
                          const isCurrentMonth = isSameMonth(day, currentMonth);
                          const isTodayDate = isToday(day);

                          return (
                            <motion.div
                              key={dateKey}
                              className={`relative p-3 sm:p-4 border transition-all ${
                                isCurrentMonth
                                  ? `${getPnLBackgroundColor(pnlValue)} border-gray-800`
                                  : "bg-gray-900/30 border-gray-900/50 opacity-50"
                              } ${isTodayDate ? "ring-2 ring-blue-500/50" : ""}`}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {/* Date Number */}
                              <div
                                className={`text-sm sm:text-base font-medium mb-2 ${
                                  isCurrentMonth ? "text-white" : "text-gray-600"
                                }`}
                              >
                                {format(day, "d")}
                              </div>

                              {/* P&L Value */}
                              <div
                                className={`text-xs sm:text-sm font-semibold ${getPnLColor(pnlValue)}`}
                              >
                                {formatPnL(pnlValue)}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer Info */}
              <div className="px-4 sm:px-6 py-3 border-t border-gray-800 bg-gray-950">
                <p className="text-xs text-gray-400 text-center">
                  P&L values are calculated for 24-hour periods in UTC time
                </p>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PnLCalendarModal;

