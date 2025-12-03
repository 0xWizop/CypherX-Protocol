"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiChevronRight, FiX, FiBarChart, FiArrowRight } from "react-icons/fi";
import { documentationSections } from "./content";
import Link from "next/link";
import Header from "@/app/components/Header";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Markdown renderer function with enhanced visual components
const renderMarkdown = (content: string): string => {
  const lines = content.split('\n');
  let html = '';
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Empty line
    if (!line) {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = null;
      }
      continue;
    }
    
    // Section headers (lines that are all caps or title case and followed by empty line)
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
    const isHeader = line.length > 0 && 
                     line.length < 100 && 
                     (line === line.toUpperCase() || /^[A-Z][a-z]/.test(line)) &&
                     (nextLine === '' || nextLine.startsWith('-'));
    
    if (isHeader && !inList) {
      if (line.length < 30) {
        html += `<h2 class="text-xl sm:text-2xl font-semibold text-white mt-6 sm:mt-8 mb-3 sm:mb-4 pb-2 border-b border-gray-800">${line}</h2>\n`;
      } else {
        html += `<h3 class="text-lg sm:text-xl font-semibold text-white mt-5 sm:mt-6 mb-2 sm:mb-3">${line}</h3>\n`;
      }
      continue;
    }
    
    // Code blocks - skip
    if (line.startsWith('```')) {
      continue;
    }
    
    // Bullet list with enhanced styling
    if (line.startsWith('- ')) {
      if (!inList || listType !== 'ul') {
        if (inList) {
          html += `</${listType}>\n`;
        }
        html += '<ul class="mb-4 space-y-2 sm:space-y-2.5">\n';
        inList = true;
        listType = 'ul';
      }
      let listContent = line.substring(2);
      html += `<li class="text-gray-300 flex items-center gap-2 text-sm sm:text-base leading-relaxed"><span class="text-blue-400 flex-shrink-0">•</span><span>${listContent}</span></li>\n`;
      continue;
    }
    
    // Numbered list
    const numberedMatch = line.match(/^\d+\. (.*)$/);
    if (numberedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) {
          html += `</${listType}>\n`;
        }
        html += '<ol class="mb-4 space-y-2 sm:space-y-2.5 list-decimal list-inside">\n';
        inList = true;
        listType = 'ol';
      }
      let listContent = numberedMatch[1];
      html += `<li class="text-gray-300 text-sm sm:text-base leading-relaxed">${listContent}</li>\n`;
      continue;
    }
    
    // Regular paragraph
    if (inList) {
      html += `</${listType}>\n`;
      inList = false;
      listType = null;
    }
    
    let paraContent = line;
    // Convert inline code
    paraContent = paraContent.replace(/`([^`]+)`/g, '<code class="bg-gray-900 text-blue-400 px-1 sm:px-1.5 py-0.5 rounded text-xs sm:text-sm font-mono border border-gray-800 break-all">$1</code>');
    
    // Convert "See X" references to links
    paraContent = paraContent.replace(/See Trading/gi, '<a href="/docs?section=trading" class="text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">See Trading</a>');
    paraContent = paraContent.replace(/See Charts/gi, '<a href="/docs?section=core-features&subsection=charts" class="text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">See Charts</a>');
    paraContent = paraContent.replace(/See Wallet/gi, '<a href="/docs?section=wallet" class="text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">See Wallet</a>');
    paraContent = paraContent.replace(/See Analytics/gi, '<a href="/docs?section=core-features&subsection=analytics" class="text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">See Analytics</a>');
    paraContent = paraContent.replace(/See Discover/gi, '<a href="/docs?section=discover" class="text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">See Discover</a>');
    paraContent = paraContent.replace(/See Explorer/gi, '<a href="/docs?section=core-features&subsection=explorer" class="text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">See Explorer</a>');
    paraContent = paraContent.replace(/See Radar/gi, '<a href="/docs?section=core-features&subsection=radar" class="text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">See Radar</a>');
    paraContent = paraContent.replace(/See Dashboard/gi, '<a href="/docs?section=dashboard" class="text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">See Dashboard</a>');
    
    // Convert Block Explorer references to links
    paraContent = paraContent.replace(/Block Explorer: https:\/\/cypherx\.trade\/explorer/gi, '<a href="/explorer" class="text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">Block Explorer: https://cypherx.trade/explorer</a>');
    paraContent = paraContent.replace(/Block Explorer: \/explorer/gi, '<a href="/explorer" class="text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">Block Explorer: /explorer</a>');
    paraContent = paraContent.replace(/Block Explorer:/gi, '<a href="/explorer" class="text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">Block Explorer</a>:');
    
    // Check if line looks like a step title (starts with "Step" and number)
    if (paraContent.match(/^Step \d+:/) && paraContent.length < 50) {
      html += `<p class="mb-3 text-white font-semibold text-base sm:text-lg">${paraContent}</p>\n`;
    } else {
      html += `<p class="mb-3 sm:mb-4 text-gray-300 leading-relaxed text-sm sm:text-base">${paraContent}</p>\n`;
    }
  }
  
  // Close any open list
  if (inList) {
    html += `</${listType}>\n`;
  }
  
  return html;
};

export default function DocsPage() {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSubsection, setSelectedSubsection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'pr' | 'issue'>('pr');
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Auto-expand section if subsection is selected
  useEffect(() => {
    if (selectedSubsection && selectedSection) {
      setExpandedSections(prev => new Set(prev).add(selectedSection));
    }
  }, [selectedSection, selectedSubsection]);

  // Handle URL parameters for deep linking
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sectionParam = params.get('section');
      const subsectionParam = params.get('subsection');
      
      if (sectionParam) {
        const section = documentationSections.find(s => s.id === sectionParam);
        if (section) {
          setSelectedSection(section.id);
          if (subsectionParam) {
            const subsection = section.subsections?.find(sub => sub.id === subsectionParam);
            if (subsection) {
              setSelectedSubsection(subsection.id);
              setExpandedSections(prev => new Set(prev).add(section.id));
            }
          }
        }
      }
    }
  }, []);

  // Keyboard shortcut for search (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredSections = documentationSections.filter((section) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(query) ||
      section.content.toLowerCase().includes(query) ||
      section.subsections?.some((sub) =>
        sub.title.toLowerCase().includes(query) ||
        sub.content.toLowerCase().includes(query)
      )
    );
  });

  const selectedSectionData = documentationSections.find(
    (s) => s.id === selectedSection
  );
  const selectedSubsectionData = selectedSectionData?.subsections?.find(
    (s) => s.id === selectedSubsection
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleOpenFeedback = (type: 'pr' | 'issue') => {
    setFeedbackType(type);
    setFeedbackTitle("");
    setFeedbackDescription("");
    setFeedbackEmail("");
    setSubmitSuccess(false);
    setShowFeedbackModal(true);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackTitle.trim() || !feedbackDescription.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'docs_feedback'), {
        type: feedbackType,
        title: feedbackTitle,
        description: feedbackDescription,
        email: feedbackEmail || 'anonymous',
        createdAt: serverTimestamp(),
        status: 'pending'
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        setSubmitSuccess(false);
        setFeedbackTitle("");
        setFeedbackDescription("");
        setFeedbackEmail("");
      }, 2000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Header />

      <main className="flex-1 flex">
        {/* Left Sidebar */}
        <aside className="hidden lg:block w-64 bg-gray-950 border-r border-gray-800/30 overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="p-4">
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-12 py-2 text-sm bg-gray-900 border border-gray-800/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-400 bg-gray-800 border border-gray-700 rounded">K</kbd>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                Docs Home
              </div>
            </div>

            <nav className="space-y-1">
              {filteredSections.map((section) => {
                const isExpanded = expandedSections.has(section.id);
                const hasSubsections = section.subsections && section.subsections.length > 0;
                
                return (
                  <div key={section.id}>
                    <button
                      onClick={() => {
                        if (hasSubsections) {
                          toggleSection(section.id);
                        }
                        setSelectedSection(section.id);
                        setSelectedSubsection(null);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center justify-between ${
                        selectedSection === section.id && !selectedSubsection
                          ? "text-blue-400 bg-blue-500/10 border-l-2 border-blue-500"
                          : "text-gray-300 hover:text-white hover:bg-gray-900/50"
                      }`}
                    >
                      <span className="text-xs sm:text-sm">{section.title}</span>
                      {hasSubsections && (
                        <FiChevronRight
                          className={`w-3 h-3 transition-transform flex-shrink-0 ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      )}
                    </button>

                    {/* Subsections */}
                    <AnimatePresence>
                      {isExpanded && hasSubsections && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="ml-4 mt-1.5 space-y-0.5 border-l-2 border-gray-800/40 pl-3 overflow-hidden"
                        >
                          {section.subsections?.map((subsection, idx) => (
                            <motion.button
                              key={subsection.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03, duration: 0.2 }}
                              onClick={() => {
                                setSelectedSection(section.id);
                                setSelectedSubsection(subsection.id);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                selectedSubsection === subsection.id
                                  ? "text-blue-400 bg-gradient-to-r from-blue-500/10 to-blue-500/5 border-l-2 border-blue-500 shadow-sm shadow-blue-500/10 font-medium"
                                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-900/40 hover:translate-x-1"
                              }`}
                            >
                              <span className="text-xs sm:text-sm">{subsection.title}</span>
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-5 lg:px-8 py-4 sm:py-6 lg:py-8">
            {/* Mobile Navigation */}
            <div className="lg:hidden mb-4 sm:mb-6 space-y-3 sm:space-y-4">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 sm:py-3 text-sm bg-gray-900 border border-gray-800/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 px-1">Section</label>
                  <select
                    value={selectedSection || ""}
                    onChange={(e) => {
                      setSelectedSection(e.target.value);
                      setSelectedSubsection(null);
                    }}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-800/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.75rem center',
                      backgroundSize: '1.25em 1.25em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="">Choose a section...</option>
                    {filteredSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.title}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedSectionData?.subsections && selectedSectionData.subsections.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 px-1">Subsection</label>
                    <select
                      value={selectedSubsection || ""}
                      onChange={(e) => setSelectedSubsection(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-800/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.75rem center',
                        backgroundSize: '1.25em 1.25em',
                        paddingRight: '2.5rem'
                      }}
                    >
                      <option value="">Choose a subsection...</option>
                      {selectedSectionData.subsections.map((subsection) => (
                        <option key={subsection.id} value={subsection.id}>
                          {subsection.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Breadcrumb */}
            {(selectedSectionData || selectedSubsectionData) && (
              <nav className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-400 flex flex-wrap items-center gap-1 sm:gap-2">
                <Link 
                  href="/docs" 
                  className={`transition-colors py-1 ${
                    !selectedSectionData && !selectedSubsectionData 
                      ? "text-blue-400" 
                      : "hover:text-white"
                  }`}
                >
                  Docs Home
                </Link>
                {selectedSectionData && (
                  <>
                    <span className="text-gray-500">/</span>
                    <button
                      onClick={() => {
                        setSelectedSection(selectedSectionData.id);
                        setSelectedSubsection(null);
                      }}
                      className={`transition-colors py-1 text-left ${
                        selectedSectionData && !selectedSubsectionData
                          ? "text-blue-400"
                          : "hover:text-white"
                      }`}
                    >
                      {selectedSectionData.title}
                    </button>
                  </>
                )}
                {selectedSubsectionData && (
                  <>
                    <span className="text-gray-500">/</span>
                    <span className="text-blue-400 py-1">{selectedSubsectionData.title}</span>
                  </>
                )}
              </nav>
            )}

            {/* Content */}
            {selectedSubsectionData ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="prose prose-invert max-w-none"
              >
                <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-800">
                  <div className="w-1 h-8 sm:h-10 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white flex-1 leading-tight">
                    {selectedSubsectionData.title}
                  </h1>
                </div>
                <div
                  className="text-gray-300 leading-relaxed prose prose-invert max-w-none text-sm sm:text-base"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(selectedSubsectionData.content),
                  }}
                />
                {selectedSubsectionData.codeExamples &&
                  selectedSubsectionData.codeExamples.length > 0 && (
                    <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
                      {selectedSubsectionData.codeExamples.map((example, idx) => (
                        <div key={idx} className="bg-gray-900 border border-gray-800/30 rounded-lg p-3 sm:p-4 overflow-hidden">
                          <div className="text-xs text-gray-400 mb-2">
                            {example.language}
                          </div>
                          <pre className="text-xs sm:text-sm text-gray-300 overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
                            <code>{example.code}</code>
                          </pre>
                          {example.description && (
                            <p className="text-sm text-gray-400 mt-2">
                              {example.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
              </motion.div>
            ) : selectedSectionData ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="prose prose-invert max-w-none"
              >
                <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-800">
                  <div className="w-1 h-8 sm:h-10 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white flex-1 leading-tight">
                    {selectedSectionData.title}
                  </h1>
                </div>
                <div
                  className="text-gray-300 leading-relaxed mb-6 prose prose-invert max-w-none text-sm sm:text-base"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(selectedSectionData.content),
                  }}
                />
                {selectedSectionData.subsections &&
                  selectedSectionData.subsections.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-6 sm:mt-8">
                      {selectedSectionData.subsections.map((subsection) => (
                        <button
                          key={subsection.id}
                          onClick={() => setSelectedSubsection(subsection.id)}
                          className="text-left p-4 sm:p-5 bg-gray-900 border border-gray-800/30 rounded-lg hover:border-blue-500/50 hover:bg-gray-800/50 transition-all group active:scale-[0.98]"
                        >
                          <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                            <div className="w-1 h-5 sm:h-6 bg-blue-500/50 group-hover:bg-blue-500 rounded-full transition-colors flex-shrink-0 mt-1"></div>
                            <h3 className="text-base sm:text-lg font-semibold text-white group-hover:text-blue-300 transition-colors flex-1">
                              {subsection.title}
                            </h3>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-400 line-clamp-3 ml-3 sm:ml-4 leading-relaxed">
                            {subsection.content.substring(0, 150)}...
                          </p>
                          <div className="mt-2 sm:mt-3 ml-3 sm:ml-4 flex items-center gap-1 text-blue-400 text-[10px] sm:text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>Read more</span>
                            <FiArrowRight className="w-3 h-3" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Breadcrumb for home */}
                <nav className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-400 flex flex-wrap items-center gap-1 sm:gap-2">
                  <span className="text-blue-400 py-1">Docs Home</span>
                </nav>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">
                  CypherX Documentation
                </h1>
                <p className="text-gray-400 mb-6 sm:mb-8 text-base sm:text-lg leading-relaxed">
                  CypherX is a comprehensive decentralized trading platform built on Base Chain that provides 
                  real-time analytics, advanced charting, and lightning-fast swap executions. Our platform 
                  combines cutting-edge technology with user-friendly design to create an unparalleled 
                  trading experience for both beginners and advanced users.
                </p>
                <p className="text-gray-300 mb-6 sm:mb-8 leading-relaxed text-sm sm:text-base">
                  CypherX is composed of distinct features and tools. Each feature is designed to help you 
                  trade more effectively, analyze markets, and manage your portfolio with confidence.
                </p>
                <p className="text-gray-300 mb-6 sm:mb-8 leading-relaxed text-sm sm:text-base">
                  The platform constantly provides real-time data and insights to help you make informed trading 
                  decisions. Key participants and features include:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-300 mb-6 sm:mb-8 text-sm sm:text-base leading-relaxed">
                  <li><strong className="text-white font-semibold">Trading</strong>—Execute swaps with minimal slippage and fast execution. See Trading.</li>
                  <li><strong className="text-white font-semibold">Charts</strong>—Professional-grade charts with multiple timeframes and indicators. See Charts.</li>
                  <li><strong className="text-white font-semibold">Wallet</strong>—Secure self-custodial wallet with backup and recovery features. See Wallet.</li>
                  <li><strong className="text-white font-semibold">Analytics</strong>—Comprehensive market data and insights for informed trading. See Analytics.</li>
                </ul>

                {/* Quick Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-8 sm:mt-12">
                  {documentationSections.slice(0, 6).map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setSelectedSection(section.id)}
                      className="text-left p-4 sm:p-6 bg-gray-900 border border-gray-800/30 rounded-lg hover:border-blue-500/50 hover:bg-gray-800/50 transition-all group active:scale-[0.98]"
                    >
                      <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="w-1 h-6 sm:h-8 bg-blue-500/50 group-hover:bg-blue-500 rounded-full transition-colors flex-shrink-0 mt-1"></div>
                        <div className="flex-1">
                          <h3 className="text-base sm:text-lg font-semibold text-white mb-1 sm:mb-2 group-hover:text-blue-300 transition-colors">
                            {section.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-400 line-clamp-3">
                            {section.content.substring(0, 120)}...
                          </p>
                        </div>
                      </div>
                      {section.subsections && section.subsections.length > 0 && (
                        <div className="mt-3 sm:mt-4 ml-3 sm:ml-4 flex items-center gap-2 text-xs text-blue-400">
                          <FiBarChart className="w-3 h-3" />
                          <span>{section.subsections.length} guide{section.subsections.length !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="hidden xl:block w-64 bg-gray-950 border-l border-gray-800/30 overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)]">
          <div className="p-6">
            <div className="space-y-6">
              <div>
                <button
                  onClick={() => handleOpenFeedback('pr')}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2 mb-2 cursor-pointer"
                >
                  SUBMIT A PR
                </button>
                <button
                  onClick={() => handleOpenFeedback('issue')}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  SUBMIT AN ISSUE
                </button>
              </div>
              
              <div className="text-xs text-gray-400">
                LAST EDIT: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
              </div>

              {selectedSectionData && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    On This Page
                  </div>
                  <div className="space-y-2">
                    {selectedSectionData.subsections?.map((subsection) => (
                      <button
                        key={subsection.id}
                        onClick={() => setSelectedSubsection(subsection.id)}
                        className={`block text-sm text-left transition-colors ${
                          selectedSubsection === subsection.id
                            ? "text-white"
                            : "text-gray-400 hover:text-gray-300"
                        }`}
                      >
                        {subsection.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md p-6 relative"
            >
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-semibold text-white mb-2">
                {feedbackType === 'pr' ? 'Submit a Pull Request' : 'Submit an Issue'}
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Help us improve our documentation by sharing your feedback.
              </p>

              {submitSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-green-400 font-medium">Thank you! Your feedback has been submitted.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={feedbackTitle}
                      onChange={(e) => setFeedbackTitle(e.target.value)}
                      placeholder={feedbackType === 'pr' ? 'Brief description of your PR' : 'Brief description of the issue'}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={feedbackDescription}
                      onChange={(e) => setFeedbackDescription(e.target.value)}
                      placeholder={feedbackType === 'pr' ? 'Describe the changes you propose...' : 'Describe the issue you encountered...'}
                      rows={6}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      value={feedbackEmail}
                      onChange={(e) => setFeedbackEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowFeedbackModal(false)}
                      className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitFeedback}
                      disabled={!feedbackTitle.trim() || !feedbackDescription.trim() || isSubmitting}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
