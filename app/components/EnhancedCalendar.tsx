"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FiCalendar,
  FiClock,
  FiUsers,
  FiTrendingUp,
  FiAward,
  FiShare2,
  FiHeart,
  FiMessageSquare,
  FiFilter,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { format, addDays, isToday } from "date-fns";

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  projectName: string;
  eventType: string;
  isFeatured?: boolean;
  reactions: {
    likes: string[];
    dislikes: string[];
    comments: { userId: string; text: string; timestamp: string | Date }[];
    rsvps: string[];
  };
}

interface EnhancedCalendarProps {
  events: Event[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  userPoints: number;
  userBadges: string[];
  onEngagement: (event: Event, action: string) => void;
  onRSVP: (event: Event) => void;
  onComment: (event: Event) => void;
  currentWeek: number;
  onWeekChange: (week: number) => void;
}

const getStartOfWeek = (date: Date) => {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
};

export default function EnhancedCalendar({
  events,
  selectedDate,
  onDateSelect,
  userPoints,
  userBadges,
  onEngagement,
  onRSVP,
  onComment,
  currentWeek,
  onWeekChange,
}: EnhancedCalendarProps) {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getWeekDates = (weekOffset: number = 0) => {
    const today = new Date();
    const startOfCurrentWeek = getStartOfWeek(today);
    const startOfTargetWeek = addDays(startOfCurrentWeek, weekOffset * 7);
    
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(startOfTargetWeek, i);
      return {
        date,
        day: format(date, "EEE"),
        dateNumber: format(date, "d"),
        fullDate: format(date, "yyyy-MM-dd"),
        isToday: isToday(date),
        isSelected: format(date, "yyyy-MM-dd") === selectedDate,
      };
    });
  };

  const weekDates = getWeekDates(currentWeek);
  const selectedDateEvents = events.filter(event => event.date === selectedDate);

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'ama': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'launch': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'giveaway': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'update': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">Event Calendar</h2>
            <p className="text-gray-400">Discover and engage with Base ecosystem events</p>
          </div>
          
          {/* User Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-blue-500/20 rounded-lg px-3 py-2">
              <FiTrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-white font-medium">{userPoints.toLocaleString()} pts</span>
            </div>
            {userBadges.length > 0 && (
              <div className="flex items-center gap-2 bg-yellow-500/20 rounded-lg px-3 py-2">
                <FiAward className="w-4 h-4 text-yellow-400" />
                <span className="text-white font-medium">{userBadges.length} badges</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
          {/* Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onWeekChange(currentWeek - 1)}
              className="p-3 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600 transition-all duration-200 hover:scale-105"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-white font-medium px-4">Week {currentWeek + 1}</span>
            <button
              onClick={() => onWeekChange(currentWeek + 1)}
              className="p-3 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600 transition-all duration-200 hover:scale-105"
            >
              <FiChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* View Mode */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Month
            </button>
          </div>

          {/* Filter */}
          <div className="relative">
            <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Events</option>
              <option value="featured">Featured</option>
              <option value="ama">AMAs</option>
              <option value="launch">Launches</option>
              <option value="giveaway">Giveaways</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
        <div className="grid grid-cols-7 gap-3">
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center pb-4">
              <div className="text-sm font-medium text-gray-400">{day}</div>
            </div>
          ))}
          
          {/* Calendar Days */}
          {weekDates.map((day) => {
            const dayEvents = events.filter(event => event.date === day.fullDate);
            const featuredEvents = dayEvents.filter(event => event.isFeatured);
            const regularEvents = dayEvents.filter(event => !event.isFeatured);
            
            return (
              <motion.div
                key={day.fullDate}
                onClick={() => onDateSelect(day.fullDate)}
                className={`relative p-4 rounded-xl cursor-pointer transition-all duration-300 min-h-[160px] flex flex-col group ${
                  day.isSelected
                    ? "bg-blue-600 text-white shadow-xl border-2 border-blue-400"
                    : day.isToday
                    ? "bg-green-600/20 text-white shadow-lg border-2 border-green-400/50"
                    : "bg-gray-800/80 text-gray-300 hover:bg-gray-700/80 hover:scale-105 hover:shadow-lg border border-gray-600/50 hover:border-gray-500/50"
                }`}
                whileHover={{ 
                  scale: 1.03,
                  y: -2,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`text-sm font-semibold ${
                    day.isSelected ? 'text-blue-100' : day.isToday ? 'text-green-100' : 'text-gray-400'
                  }`}>
                    {day.day}
                  </div>
                  {day.isToday && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-300 font-medium">TODAY</span>
                    </div>
                  )}
                </div>
                
                {/* Date Number */}
                <div className={`text-3xl font-bold text-center mb-3 ${
                  day.isSelected ? 'text-white' : day.isToday ? 'text-green-100' : 'text-white'
                }`}>
                  {day.dateNumber}
                </div>
                
                {/* Event Summary */}
                {dayEvents.length > 0 && (
                  <div className="mt-auto">
                    {/* Featured Events */}
                    {featuredEvents.length > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center gap-1 mb-1">
                          <FiAward className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs font-medium text-yellow-300">Featured</span>
                        </div>
                        <div className="flex gap-1">
                          {featuredEvents.slice(0, 2).map((_, index) => (
                            <div
                              key={index}
                              className="w-1.5 h-1.5 bg-yellow-400 rounded-full"
                            />
                          ))}
                          {featuredEvents.length > 2 && (
                            <span className="text-xs text-yellow-300/70">+{featuredEvents.length - 2}</span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Regular Events */}
                    {regularEvents.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <FiCalendar className="w-3 h-3 text-blue-400" />
                          <span className="text-xs font-medium text-blue-300">Events</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {regularEvents.slice(0, 4).map((event, index) => (
                            <div
                              key={index}
                              className={`w-1.5 h-1.5 rounded-full ${
                                event.eventType === 'ama' 
                                  ? 'bg-purple-400'
                                  : event.eventType === 'launch'
                                    ? 'bg-green-400'
                                    : event.eventType === 'giveaway'
                                      ? 'bg-yellow-400'
                                      : 'bg-blue-400'
                              }`}
                            />
                          ))}
                          {regularEvents.length > 4 && (
                            <span className="text-xs text-blue-300/70">+{regularEvents.length - 4}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Empty State */}
                {dayEvents.length === 0 && (
                  <div className="mt-auto text-center">
                    <div className="w-1 h-1 bg-gray-500/30 rounded-full mx-auto"></div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Events */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">
            Events for {format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}
          </h3>
          <div className="text-sm text-gray-400">
            {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        {selectedDateEvents.length === 0 ? (
          <div className="text-center py-12">
            <FiCalendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No events scheduled for this date</p>
            <p className="text-gray-500 text-sm mt-2">Be the first to add an event!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedDateEvents.map((event) => (
              <motion.div
                key={event.id}
                className="bg-gray-700/50 backdrop-blur-sm rounded-xl border border-gray-600 p-6 hover:border-gray-500 transition-all duration-200"
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h4 className="text-xl font-bold text-white">{event.title}</h4>
                      {event.isFeatured && (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30">
                          Featured
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs rounded-full capitalize border ${getEventTypeColor(event.eventType)}`}>
                        {event.eventType}
                      </span>
                    </div>
                    
                    <p className="text-gray-300 mb-4 leading-relaxed">{event.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-4">
                      <div className="flex items-center gap-2">
                        <FiUsers className="w-4 h-4" />
                        <span>{event.projectName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FiClock className="w-4 h-4" />
                        <span>{event.time}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Event Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => onEngagement(event, "like")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                        event.reactions.likes.includes('user-id') // Replace with actual user ID
                          ? "bg-blue-600 text-white shadow-lg"
                          : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                      }`}
                    >
                      <FiHeart className="w-4 h-4" />
                      <span>{event.reactions.likes.length}</span>
                    </button>
                    
                    <button
                      onClick={() => onRSVP(event)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                        event.reactions.rsvps.includes('user-id') // Replace with actual user ID
                          ? "bg-green-600 text-white shadow-lg"
                          : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                      }`}
                    >
                      <FiCalendar className="w-4 h-4" />
                      <span>RSVP ({event.reactions.rsvps.length})</span>
                    </button>
                    
                    <button
                      onClick={() => onComment(event)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-500 transition-all duration-200 hover:scale-105"
                    >
                      <FiMessageSquare className="w-4 h-4" />
                      <span>Comments ({event.reactions.comments.length})</span>
                    </button>
                    
                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-500 transition-all duration-200 hover:scale-105">
                      <FiShare2 className="w-4 h-4" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 