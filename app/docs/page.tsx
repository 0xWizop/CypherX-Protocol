"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FiBook, FiChevronRight, FiSearch } from "react-icons/fi";
import { HiOutlineSparkles, HiOutlineChartBar, HiOutlineCurrencyDollar, HiOutlineCube, HiOutlineGlobeAlt, HiOutlineRocketLaunch, HiOutlineCommandLine, HiOutlineWallet, HiOutlineGift, HiOutlineMap, HiOutlineDocumentText, HiOutlineCog6Tooth, HiOutlineChartPie } from "react-icons/hi2";
import { documentationSections } from "./content";

// Markdown renderer function
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
    
    // Headers
    if (line.startsWith('### ')) {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = null;
      }
      html += `<h3 class="text-xl font-semibold text-white mt-6 mb-3">${line.substring(4)}</h3>\n`;
      continue;
    }
    
    if (line.startsWith('## ')) {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = null;
      }
      html += `<h2 class="text-2xl font-semibold text-white mt-8 mb-4">${line.substring(3)}</h2>\n`;
      continue;
    }
    
    if (line.startsWith('# ')) {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = null;
      }
      html += `<h1 class="text-3xl font-bold text-white mt-8 mb-4">${line.substring(2)}</h1>\n`;
      continue;
    }
    
    // Code blocks - skip
    if (line.startsWith('```')) {
      continue;
    }
    
    // Bullet list
    if (line.startsWith('- ')) {
      if (!inList || listType !== 'ul') {
        if (inList) {
          html += `</${listType}>\n`;
        }
        html += '<ul class="mb-4 space-y-2 list-disc list-inside">\n';
        inList = true;
        listType = 'ul';
      }
      let listContent = line.substring(2);
      // Process bold text in list items
      listContent = listContent.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
      html += `<li class="text-gray-300">${listContent}</li>\n`;
      continue;
    }
    
    // Numbered list
    const numberedMatch = line.match(/^\d+\. (.*)$/);
    if (numberedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) {
          html += `</${listType}>\n`;
        }
        html += '<ol class="mb-4 space-y-2 list-decimal list-inside">\n';
        inList = true;
        listType = 'ol';
      }
      let listContent = numberedMatch[1];
      listContent = listContent.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
      html += `<li class="text-gray-300">${listContent}</li>\n`;
      continue;
    }
    
    // Regular paragraph
    if (inList) {
      html += `</${listType}>\n`;
      inList = false;
      listType = null;
    }
    
    let paraContent = line;
    // Convert bold text
    paraContent = paraContent.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
    // Convert inline code
    paraContent = paraContent.replace(/`([^`]+)`/g, '<code class="bg-[#111827] text-blue-400 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
    
    html += `<p class="mb-4 text-gray-300 leading-relaxed">${paraContent}</p>\n`;
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

  return (
    <div className="min-h-screen flex flex-col bg-[#070c14]">
      <main className="flex-1 flex">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 bg-[#0d1117] border-r border-gray-800/30 overflow-y-auto sticky top-0 h-screen">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-6">
              <HiOutlineDocumentText className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Documentation</h2>
            </div>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm bg-[#111827] border border-gray-800/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              {filteredSections.map((section) => (
                <div key={section.id}>
                  <button
                    onClick={() => {
                      setSelectedSection(section.id);
                      setSelectedSubsection(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      selectedSection === section.id
                        ? "bg-blue-500/20 text-blue-300"
                        : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
                    }`}
                  >
                    <span>{section.title}</span>
                    {section.subsections && section.subsections.length > 0 && (
                      <FiChevronRight
                        className={`w-4 h-4 transition-transform ${
                          selectedSection === section.id ? "rotate-90" : ""
                        }`}
                      />
                    )}
                  </button>

                  {/* Subsections */}
                  {selectedSection === section.id &&
                    section.subsections &&
                    section.subsections.length > 0 && (
                      <div className="ml-4 mt-1 space-y-1">
                        {section.subsections.map((subsection) => (
                          <button
                            key={subsection.id}
                            onClick={() => setSelectedSubsection(subsection.id)}
                            className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                              selectedSubsection === subsection.id
                                ? "bg-blue-500/10 text-blue-300"
                                : "text-gray-400 hover:bg-gray-800/30 hover:text-gray-300"
                            }`}
                          >
                            {subsection.title}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Mobile Navigation */}
            <div className="lg:hidden mb-6">
              <div className="flex items-center gap-2 mb-4">
                <FiBook className="w-5 h-5 text-blue-400" />
                <h1 className="text-2xl font-bold text-white">Documentation</h1>
              </div>
              <div className="relative mb-4">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm bg-[#111827] border border-gray-800/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <select
                value={selectedSection || ""}
                onChange={(e) => {
                  setSelectedSection(e.target.value);
                  setSelectedSubsection(null);
                }}
                className="w-full px-3 py-2 bg-[#111827] border border-gray-800/30 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a section...</option>
                {filteredSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
              {selectedSectionData?.subsections && selectedSectionData.subsections.length > 0 && (
                <select
                  value={selectedSubsection || ""}
                  onChange={(e) => setSelectedSubsection(e.target.value)}
                  className="w-full mt-2 px-3 py-2 bg-[#111827] border border-gray-800/30 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a subsection...</option>
                  {selectedSectionData.subsections.map((subsection) => (
                    <option key={subsection.id} value={subsection.id}>
                      {subsection.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Content */}
            {selectedSubsectionData ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="prose prose-invert max-w-none"
              >
                <div className="mb-4">
                  <button
                    onClick={() => setSelectedSubsection(null)}
                    className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                  >
                    ← Back to {selectedSectionData?.title || 'Documentation'}
                  </button>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {selectedSubsectionData.title}
                </h1>
                <div
                  className="text-gray-300 leading-relaxed prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(selectedSubsectionData.content),
                  }}
                />
                {selectedSubsectionData.codeExamples &&
                  selectedSubsectionData.codeExamples.length > 0 && (
                    <div className="mt-6 space-y-4">
                      {selectedSubsectionData.codeExamples.map((example, idx) => (
                        <div key={idx} className="bg-[#0d1117] border border-gray-800/30 rounded-lg p-4">
                          <div className="text-xs text-gray-400 mb-2">
                            {example.language}
                          </div>
                          <pre className="text-sm text-gray-300 overflow-x-auto">
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
                <h1 className="text-3xl font-bold text-white mb-4">
                  {selectedSectionData.title}
                </h1>
                <div
                  className="text-gray-300 leading-relaxed mb-6 prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(selectedSectionData.content),
                  }}
                />
                {selectedSectionData.subsections &&
                  selectedSectionData.subsections.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                      {selectedSectionData.subsections.map((subsection) => (
                        <button
                          key={subsection.id}
                          onClick={() => setSelectedSubsection(subsection.id)}
                          className="text-left p-4 bg-[#0d1117] border border-gray-800/30 rounded-lg hover:border-blue-500/50 hover:bg-[#111827] transition-all"
                        >
                          <h3 className="text-lg font-semibold text-white mb-2">
                            {subsection.title}
                          </h3>
                          <p className="text-sm text-gray-400 line-clamp-2">
                            {subsection.content.substring(0, 150)}...
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-3 mb-4">
                  <HiOutlineDocumentText className="w-10 h-10 text-blue-400" />
                  <h1 className="text-4xl font-bold text-white">CypherX Documentation</h1>
                </div>
                <p className="text-gray-400 mb-8 text-lg">
                  Comprehensive guides and references for using CypherX Protocol
                </p>

                {/* Quick Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
                  {documentationSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setSelectedSection(section.id)}
                      className="text-left p-6 bg-[#0d1117] border border-gray-800/30 rounded-lg hover:border-blue-500/50 hover:bg-[#111827] transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                          {section.id === "overview" && <HiOutlineSparkles className="w-6 h-6 text-blue-400" />}
                          {section.id === "getting-started" && <HiOutlineRocketLaunch className="w-6 h-6 text-blue-400" />}
                          {section.id === "core-features" && <HiOutlineChartBar className="w-6 h-6 text-blue-400" />}
                          {section.id === "discover" && <HiOutlineGlobeAlt className="w-6 h-6 text-blue-400" />}
                          {section.id === "dashboard" && <HiOutlineChartPie className="w-6 h-6 text-blue-400" />}
                          {section.id === "radar" && <HiOutlineCommandLine className="w-6 h-6 text-blue-400" />}
                          {section.id === "rewards" && <HiOutlineGift className="w-6 h-6 text-blue-400" />}
                          {section.id === "explorer" && <HiOutlineMap className="w-6 h-6 text-blue-400" />}
                          {section.id === "advanced-orders" && <HiOutlineCog6Tooth className="w-6 h-6 text-blue-400" />}
                          {section.id === "trading" && <HiOutlineCurrencyDollar className="w-6 h-6 text-blue-400" />}
                          {section.id === "wallet" && <HiOutlineWallet className="w-6 h-6 text-blue-400" />}
                          {section.id === "advanced" && <HiOutlineCube className="w-6 h-6 text-blue-400" />}
                          {!["overview", "getting-started", "core-features", "discover", "dashboard", "radar", "rewards", "explorer", "advanced-orders", "trading", "wallet", "advanced"].includes(section.id) && <HiOutlineDocumentText className="w-6 h-6 text-blue-400" />}
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          {section.title}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-3">
                        {section.content.substring(0, 120)}...
                      </p>
                      {section.subsections && section.subsections.length > 0 && (
                        <div className="mt-4 text-xs text-blue-400">
                          {section.subsections.length} guide{section.subsections.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

