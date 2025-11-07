"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  getDocs,
  getDoc,
  query,
  doc,
  addDoc,
  updateDoc,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiCheck,
  FiX,
  FiCalendar,
  FiClock,
  FiUser,
  FiShield,
  FiAward,
  FiMessageCircle,
  FiThumbsUp,
  FiThumbsDown,
  FiSend,
} from "react-icons/fi";
import { format, startOfWeek, addDays, addWeeks, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from "date-fns";
import toast from "react-hot-toast";
import { useAuth } from "@/app/providers";
import Header from "../components/Header";
import Footer from "../components/Footer";

// ────────── Types ──────────

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  createdBy: string;
  createdByName?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  rejectionReason?: string;
}

interface EventComment {
  id: string;
  eventId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: Timestamp;
  likes: string[];
  dislikes: string[];
}

interface UserRole {
  isModerator: boolean;
  points: number;
  walletAddress?: string;
}

// ────────── Main Component ──────────

export default function EventsPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [events, setEvents] = useState<Event[]>([]);
  const [userRole, setUserRole] = useState<UserRole>({ isModerator: false, points: 0 });
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showEventRoom, setShowEventRoom] = useState(false);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventComments, setEventComments] = useState<EventComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);

  // Proposal form state
  const [proposalForm, setProposalForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
  });

  // ────────── Date Calculations ──────────

  const getWeekDates = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return {
        date,
        day: format(date, "EEE"),
        dateNumber: format(date, "d"),
        month: format(date, "MMM"),
        fullDate: format(date, "yyyy-MM-dd"),
        isToday: isToday(date),
      };
    });
  };

  const getMonthDates = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    
    // Pad with previous month days to fill first week
    const firstDay = days[0];
    const firstDayOfWeek = firstDay.getDay();
    const paddedDays: Date[] = [];
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      paddedDays.push(addDays(firstDay, -i - 1));
    }
    
    return [...paddedDays, ...days].map(date => ({
      date,
      day: format(date, "EEE"),
      dateNumber: format(date, "d"),
      month: format(date, "MMM"),
      fullDate: format(date, "yyyy-MM-dd"),
      isToday: isToday(date),
      isCurrentMonth: isSameMonth(date, currentDate),
    }));
  };

  // ────────── Navigation ──────────

  const goToPreviousWeek = () => {
    setCurrentDate(addWeeks(currentDate, -1));
  };

  const goToNextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };

  const goToPreviousMonth = () => {
    setCurrentDate(addMonths(currentDate, -1));
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // ────────── Firebase Operations ──────────

  // Fetch events (available to everyone)
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Fetch approved events
        const eventsQuery = query(
          collection(db, "events"),
          where("status", "==", "approved"),
          orderBy("date", "asc")
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        const eventsData = eventsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Event[];
        
        setEvents(eventsData);
        console.log(`✅ Loaded ${eventsData.length} events`);
      } catch (error) {
        console.error("Error fetching events:", error);
        // If query fails due to missing index, try without orderBy
        try {
          const eventsQuery = query(
            collection(db, "events"),
            where("status", "==", "approved")
          );
          const eventsSnapshot = await getDocs(eventsQuery);
          const eventsData = eventsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as Event[];
          
          // Sort manually
          eventsData.sort((a, b) => a.date.localeCompare(b.date));
          setEvents(eventsData);
          console.log(`✅ Loaded ${eventsData.length} events (without index)`);
        } catch (fallbackError) {
          console.error("Error fetching events (fallback):", fallbackError);
          toast.error("Failed to load events. Please check Firestore indexes.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Fetch user role (only if logged in)
  useEffect(() => {
    if (!user) {
      return;
    }

    const fetchUserRole = async () => {
      try {
        // Fetch user role - try document ID as uid first (common pattern)
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setUserRole({
            isModerator: userData.isModerator || false,
            points: userData.points || 0,
            walletAddress: userData.walletAddress,
          });
        } else {
          // Fallback: try query by uid field
          const userQuery = query(collection(db, "users"), where("uid", "==", user.uid));
          const userDocs = await getDocs(userQuery);
          if (!userDocs.empty) {
            const userData = userDocs.docs[0].data();
            setUserRole({
              isModerator: userData.isModerator || false,
              points: userData.points || 0,
              walletAddress: userData.walletAddress,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };

    fetchUserRole();
  }, [user]);

  // Fetch comments for selected event
  useEffect(() => {
    if (!selectedEvent || !showEventRoom) return;

    const fetchComments = async () => {
      try {
        const commentsQuery = query(
          collection(db, "eventComments"),
          where("eventId", "==", selectedEvent.id),
          orderBy("createdAt", "desc")
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        const commentsData = commentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as EventComment[];
        setEventComments(commentsData);
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    };

    fetchComments();
  }, [selectedEvent, showEventRoom]);

  // ────────── Proposal Submission ──────────

  const handleSubmitProposal = async () => {
    if (!user) {
      toast.error("Please login to submit proposals");
      return;
    }

    if (!proposalForm.title || !proposalForm.description || !proposalForm.date || !proposalForm.time) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const eventData: Omit<Event, "id"> = {
        title: proposalForm.title,
        description: proposalForm.description,
        date: proposalForm.date,
        time: proposalForm.time,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || "Anonymous",
        status: "pending",
        createdAt: serverTimestamp() as Timestamp,
      };

      await addDoc(collection(db, "events"), eventData);
      
      toast.success("Proposal submitted successfully!");
      setProposalForm({ title: "", description: "", date: "", time: "" });
      setShowProposalModal(false);
      
      // Refresh events
      const eventsQuery = query(
        collection(db, "events"),
        where("status", "==", "approved"),
        orderBy("date", "asc")
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Event[];
      setEvents(eventsData);
    } catch (error) {
      console.error("Error submitting proposal:", error);
      toast.error("Failed to submit proposal");
    }
  };

  // ────────── Moderation Actions ──────────

  const handleApproveEvent = async (event: Event) => {
    if (!event.id) return;

    try {
      await updateDoc(doc(db, "events", event.id), {
        status: "approved",
        reviewedBy: user?.uid,
        reviewedAt: serverTimestamp(),
      });

      // Award points to event creator using unified points API
      if (event.createdBy) {
        try {
          // Get creator's wallet address
          const creatorDocRef = doc(db, "users", event.createdBy);
          const creatorDocSnap = await getDoc(creatorDocRef);
          const creatorWallet = creatorDocSnap.exists() 
            ? creatorDocSnap.data().walletAddress 
            : null;

          if (creatorWallet) {
            const response = await fetch("/api/points/earn", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: event.createdBy,
                walletAddress: creatorWallet,
                action: "event_proposal_approved",
                metadata: { eventId: event.id },
              }),
            });

            if (response.ok) {
              toast.success("Event approved! Creator awarded 50 points.");
            }
          }
        } catch (error) {
          console.error("Error awarding points:", error);
        }
      }

      toast.success("Event approved!");
      setShowModerationModal(false);
      setSelectedEvent(null);

      // Refresh events
      const eventsQuery = query(
        collection(db, "events"),
        where("status", "==", "approved"),
        orderBy("date", "asc")
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Event[];
      setEvents(eventsData);
    } catch (error) {
      console.error("Error approving event:", error);
      toast.error("Failed to approve event");
    }
  };

  const handleRejectEvent = async (event: Event, reason: string) => {
    if (!event.id) return;

    try {
      await updateDoc(doc(db, "events", event.id), {
        status: "rejected",
        reviewedBy: user?.uid,
        reviewedAt: serverTimestamp(),
        rejectionReason: reason,
      });

      toast.success("Event rejected");
      setShowModerationModal(false);
      setSelectedEvent(null);

      // Refresh events
      const eventsQuery = query(
        collection(db, "events"),
        where("status", "==", "approved"),
        orderBy("date", "asc")
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Event[];
      setEvents(eventsData);
    } catch (error) {
      console.error("Error rejecting event:", error);
      toast.error("Failed to reject event");
    }
  };

  // ────────── Comments ──────────

  const handleSubmitComment = async () => {
    if (!user || !selectedEvent || !newComment.trim()) return;

    try {
      const commentData = {
        eventId: selectedEvent.id,
        userId: user.uid,
        username: user.displayName || user.email?.split("@")[0] || "Anonymous",
        content: newComment.trim(),
        createdAt: serverTimestamp(),
        likes: [],
        dislikes: [],
      };

      await addDoc(collection(db, "eventComments"), commentData);
      
      // Award points for commenting
      if (userRole.walletAddress) {
        try {
          await fetch("/api/points/earn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.uid,
              walletAddress: userRole.walletAddress,
              action: "comment_article", // Using existing comment action
              metadata: { eventId: selectedEvent.id },
            }),
          });
        } catch (error) {
          console.error("Error awarding points:", error);
        }
      }

      setNewComment("");
      toast.success("Comment posted!");

      // Refresh comments
      const commentsQuery = query(
        collection(db, "eventComments"),
        where("eventId", "==", selectedEvent.id),
        orderBy("createdAt", "desc")
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const commentsData = commentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as EventComment[];
      setEventComments(commentsData);
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment");
    }
  };

  const handleToggleLike = async (comment: EventComment) => {
    if (!user || !selectedEvent) return;

    const isLiked = comment.likes.includes(user.uid);
    const isDisliked = comment.dislikes.includes(user.uid);

    try {
      const commentRef = doc(db, "eventComments", comment.id);
      
      if (isLiked) {
        await updateDoc(commentRef, {
          likes: arrayRemove(user.uid),
        });
      } else {
        const updates: any = {
          likes: arrayUnion(user.uid),
        };
        if (isDisliked) {
          updates.dislikes = arrayRemove(user.uid);
        }
        await updateDoc(commentRef, updates);
      }

      // Refresh comments
      const commentsQuery = query(
        collection(db, "eventComments"),
        where("eventId", "==", selectedEvent.id),
        orderBy("createdAt", "desc")
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const commentsData = commentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as EventComment[];
      setEventComments(commentsData);
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleToggleDislike = async (comment: EventComment) => {
    if (!user || !selectedEvent) return;

    const isLiked = comment.likes.includes(user.uid);
    const isDisliked = comment.dislikes.includes(user.uid);

    try {
      const commentRef = doc(db, "eventComments", comment.id);
      
      if (isDisliked) {
        await updateDoc(commentRef, {
          dislikes: arrayRemove(user.uid),
        });
      } else {
        const updates: any = {
          dislikes: arrayUnion(user.uid),
        };
        if (isLiked) {
          updates.likes = arrayRemove(user.uid);
        }
        await updateDoc(commentRef, updates);
      }

      // Refresh comments
      const commentsQuery = query(
        collection(db, "eventComments"),
        where("eventId", "==", selectedEvent.id),
        orderBy("createdAt", "desc")
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const commentsData = commentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as EventComment[];
      setEventComments(commentsData);
    } catch (error) {
      console.error("Error toggling dislike:", error);
    }
  };

  // ────────── Filter Events by Date ──────────

  const getEventsForDate = (date: string) => {
    return events.filter(e => e.date === date);
  };

  // ────────── Render ──────────

  if (loading) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const dates = viewMode === "week" ? getWeekDates() : getMonthDates();

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Top Bar - Reduced Size */}
        <div className="bg-gray-900/50 border-b border-gray-800/20 px-4 py-1.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <h1 className="text-xs font-medium text-gray-300">Events</h1>
            {userRole.isModerator && (
              <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs">
                <FiShield className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-blue-400">Mod</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-800/50 rounded p-0.5">
              <button
                onClick={() => setViewMode("week")}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === "week"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === "month"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Month
              </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center space-x-1">
              <button
                onClick={viewMode === "week" ? goToPreviousWeek : goToPreviousMonth}
                className="p-1.5 bg-gray-800/50 hover:bg-gray-700/50 rounded text-gray-400 hover:text-white transition-all"
              >
                <FiChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goToToday}
                className="px-2 py-1 bg-gray-800/50 hover:bg-gray-700/50 rounded text-xs text-gray-300 hover:text-white transition-all"
              >
                Today
              </button>
              <button
                onClick={viewMode === "week" ? goToNextWeek : goToNextMonth}
                className="p-1.5 bg-gray-800/50 hover:bg-gray-700/50 rounded text-gray-400 hover:text-white transition-all"
              >
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Date Display */}
            <div className="text-white text-xs font-medium">
              {viewMode === "week" 
                ? `${format(dates[0].date, "MMM d")} - ${format(dates[dates.length - 1].date, "MMM d")}`
                : format(currentDate, "MMM yyyy")
              }
            </div>

            {/* Submit Proposal Button */}
            {user && (
              <button
                onClick={() => setShowProposalModal(true)}
                className="flex items-center space-x-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-all"
              >
                <FiPlus className="w-3 h-3" />
                <span>Submit</span>
              </button>
            )}

            {/* Points Display */}
            {user && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-gray-800/50 rounded">
                <FiAward className="w-3 h-3 text-yellow-400" />
                <span className="text-xs text-white font-medium">{userRole.points}</span>
              </div>
            )}
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-hidden p-3 min-h-0">
          <div className="h-full bg-gray-900/30 rounded-xl border border-gray-800/20 overflow-hidden">
            {viewMode === "week" ? (
              <div className="h-full grid gap-px bg-gray-800/20" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {dates.map((day, index) => {
                  const dayEvents = getEventsForDate(day.fullDate);
                  return (
                    <div
                      key={index}
                      className={`flex flex-col border-r border-gray-800/20 ${
                        day.isToday ? "bg-blue-500/10" : "bg-gray-900/50"
                      }`}
                    >
                      <div className={`p-2 border-b border-gray-800/20 ${
                        day.isToday ? "bg-blue-500/20" : "bg-gray-800/30"
                      }`}>
                        <div className="text-xs text-gray-400 uppercase">{day.day}</div>
                        <div className={`text-lg font-semibold ${
                          day.isToday ? "text-blue-400" : "text-white"
                        }`}>
                          {day.dateNumber}
                        </div>
                        <div className="text-xs text-gray-500">{day.month}</div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {dayEvents.map((event) => (
                          <div
                            key={event.id}
                            onClick={() => {
                              setSelectedEvent(event);
                              setShowEventRoom(true);
                            }}
                            className="p-2 rounded text-xs cursor-pointer transition-all bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30"
                          >
                            <div className="font-medium truncate">{event.title}</div>
                            <div className="text-xs opacity-75">{event.time}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {/* Month Header */}
                <div className="grid grid-cols-7 gap-px bg-gray-800/20 border-b border-gray-800/20">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="p-3 bg-gray-800/30 text-center text-sm text-gray-400 font-medium">
                      {day}
                    </div>
                  ))}
                </div>
                {/* Month Grid */}
                <div className="flex-1 grid grid-cols-7 gap-px bg-gray-800/20">
                  {dates.map((day, index) => {
                    const dayEvents = getEventsForDate(day.fullDate);
                    const eventCount = dayEvents.length;
                    return (
                      <div
                        key={index}
                        className={`flex flex-col border-r border-b border-gray-800/20 ${
                          !day.isCurrentMonth ? "bg-gray-900/30 opacity-50" : day.isToday ? "bg-blue-500/10" : "bg-gray-900/50"
                        }`}
                      >
                        <div className={`p-2 ${day.isToday ? "bg-blue-500/20" : ""}`}>
                          <div className={`text-sm font-semibold ${
                            day.isToday ? "text-blue-400" : day.isCurrentMonth ? "text-white" : "text-gray-600"
                          }`}>
                            {day.dateNumber}
                          </div>
                          {eventCount > 0 && (
                            <div className="text-xs text-blue-400 mt-1">
                              {eventCount} event{eventCount > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden p-1">
                          {dayEvents.slice(0, 2).map((event) => (
                            <div
                              key={event.id}
                              onClick={() => {
                                setSelectedEvent(event);
                                setShowEventRoom(true);
                              }}
                              className="p-1 mb-1 rounded text-xs cursor-pointer transition-all bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 truncate"
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          ))}
                          {eventCount > 2 && (
                            <div className="text-xs text-gray-500 text-center mt-1">
                              +{eventCount - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <div className="flex-shrink-0">
        <Footer />
      </div>

      {/* Proposal Submission Modal */}
      <AnimatePresence>
        {showProposalModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowProposalModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Submit Event Proposal</h2>
                <button
                  onClick={() => setShowProposalModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Event Title</label>
                  <input
                    type="text"
                    value={proposalForm.title}
                    onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter event title"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">Description</label>
                  <textarea
                    value={proposalForm.description}
                    onChange={(e) => setProposalForm({ ...proposalForm, description: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={4}
                    placeholder="Enter event description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Date</label>
                    <input
                      type="date"
                      value={proposalForm.date}
                      onChange={(e) => setProposalForm({ ...proposalForm, date: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Time</label>
                    <input
                      type="time"
                      value={proposalForm.time}
                      onChange={(e) => setProposalForm({ ...proposalForm, time: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <FiAward className="w-4 h-4 text-yellow-400" />
                  <span>Earn points if your proposal is approved</span>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowProposalModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitProposal}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                  >
                    Submit Proposal
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event Room Modal */}
      <AnimatePresence>
        {showEventRoom && selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowEventRoom(false);
              setSelectedEvent(null);
              setEventComments([]);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold text-white">{selectedEvent.title}</h2>
                  <button
                    onClick={() => {
                      setShowEventRoom(false);
                      setSelectedEvent(null);
                      setEventComments([]);
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <FiCalendar className="w-4 h-4" />
                    <span>{format(new Date(selectedEvent.date), "MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-400">
                    <FiClock className="w-4 h-4" />
                    <span>{selectedEvent.time}</span>
                  </div>
                  <p className="text-gray-300 mt-4">{selectedEvent.description}</p>
                </div>
              </div>

              {/* Comments Section */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {eventComments.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <FiMessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No comments yet. Be the first to comment!</p>
                  </div>
                ) : (
                  eventComments.map((comment) => (
                    <div key={comment.id} className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <FiUser className="w-4 h-4 text-gray-400" />
                          <span className="text-white font-medium">{comment.username}</span>
                          <span className="text-xs text-gray-500">
                            {comment.createdAt && typeof comment.createdAt.toDate === 'function'
                              ? format(comment.createdAt.toDate(), "MMM d, h:mm a")
                              : "Recently"}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-300 mb-3">{comment.content}</p>
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => handleToggleLike(comment)}
                          className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition-all ${
                            comment.likes.includes(user?.uid || "")
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-gray-700/50 text-gray-400 hover:bg-gray-700"
                          }`}
                        >
                          <FiThumbsUp className="w-4 h-4" />
                          <span>{comment.likes.length}</span>
                        </button>
                        <button
                          onClick={() => handleToggleDislike(comment)}
                          className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition-all ${
                            comment.dislikes.includes(user?.uid || "")
                              ? "bg-red-500/20 text-red-400"
                              : "bg-gray-700/50 text-gray-400 hover:bg-gray-700"
                          }`}
                        >
                          <FiThumbsDown className="w-4 h-4" />
                          <span>{comment.dislikes.length}</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Comment Input */}
              {user && (
                <div className="p-6 border-t border-gray-700">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitComment();
                        }
                      }}
                      placeholder="Add a comment..."
                      className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleSubmitComment}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                    >
                      <FiSend className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Moderation Modal */}
      <AnimatePresence>
        {showModerationModal && selectedEvent && userRole.isModerator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModerationModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Review Proposal</h2>
                <button
                  onClick={() => setShowModerationModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Title</div>
                  <div className="text-white font-medium">{selectedEvent.title}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-400 mb-1">Description</div>
                  <div className="text-white">{selectedEvent.description}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Date</div>
                    <div className="text-white">{format(new Date(selectedEvent.date), "MMM d, yyyy")}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Time</div>
                    <div className="text-white">{selectedEvent.time}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-400 mb-1">Submitted by</div>
                  <div className="text-white">{selectedEvent.createdByName || "Anonymous"}</div>
                </div>

                {selectedEvent.status === "pending" && (
                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={() => {
                        const reason = prompt("Enter rejection reason (optional):");
                        if (reason !== null) {
                          handleRejectEvent(selectedEvent, reason);
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center justify-center space-x-2"
                    >
                      <FiX className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleApproveEvent(selectedEvent)}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all flex items-center justify-center space-x-2"
                    >
                      <FiCheck className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
