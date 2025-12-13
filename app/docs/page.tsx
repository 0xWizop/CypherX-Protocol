"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { documentationSections, searchIndex } from "./content";
import { 
  FiSearch, 
  FiChevronRight, 
  FiCode, 
  FiCopy, 
  FiCheck, 
  FiBook,
  FiZap,
  FiTrendingUp,
  FiShield,
  FiGlobe,
  FiLink,
  FiExternalLink
} from "react-icons/fi";

interface DocSection {
  id: string;
  title: string;
  content: string;
  subsections?: DocSubsection[];
}

interface DocSubsection {
  id: string;
  title: string;
  content: string;
  codeExamples?: CodeExample[];
}

interface CodeExample {
  language: string;
  code: string;
  description: string;
}

// Modern Code Block Component
const CodeBlock = ({ language, code }: { language: string; code: string[] }) => {
  const [copied, setCopied] = useState(false);
  const codeText = code.join('\n');

  return (
    <div className="mb-6 relative group">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{language}</span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(codeText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all"
        >
          {copied ? (
            <>
              <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <FiCopy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="relative">
        <pre className="bg-gray-900/80 rounded-xl p-5 overflow-x-auto border border-gray-800/50 shadow-lg">
          <code className="text-sm text-gray-100 font-mono whitespace-pre leading-relaxed">
            {codeText}
          </code>
        </pre>
      </div>
    </div>
  );
};

// API Endpoint Card Component
const APIEndpointCard = ({ method, path, description }: { method: string; path: string; description?: string }) => {
  const methodColors: Record<string, string> = {
    GET: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    POST: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    PUT: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
    PATCH: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };

  return (
    <div className="bg-gray-900/40 rounded-xl p-4 border border-gray-800/30 hover:border-gray-700/50 transition-all group">
      <div className="flex items-start gap-3">
        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${methodColors[method] || methodColors.GET}`}>
          {method}
        </span>
        <div className="flex-1 min-w-0">
          <code className="text-sm text-white font-mono break-all">{path}</code>
          {description && (
            <p className="text-xs text-gray-400 mt-1.5">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Info Card Component
const InfoCard = ({ icon: Icon, title, children, className = "" }: { 
  icon: React.ElementType; 
  title: string; 
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={`bg-gray-900/40 rounded-xl p-5 border border-gray-800/30 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <div className="text-sm text-gray-300 leading-relaxed">
        {children}
      </div>
    </div>
  );
};

// Badge Component
const Badge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "info" }) => {
  const variants = {
    default: "bg-gray-800/50 text-gray-300",
    success: "bg-emerald-500/20 text-emerald-400",
    warning: "bg-yellow-500/20 text-yellow-400",
    info: "bg-blue-500/20 text-blue-400",
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
};

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let currentParagraph: string[] = [];
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let codeBlockContent: string[] = [];
  let listItems: string[] = [];
  let inList = false;

  const renderParagraph = (text: string) => {
    if (!text.trim()) return null;
    
    // Check for inline code
    const parts = text.split(/(`[^`]+`)/);
    const formattedParts = parts.map((part, idx) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        const code = part.slice(1, -1);
        return (
          <code key={idx} className="px-2 py-0.5 bg-gray-800/60 rounded text-blue-400 text-sm font-mono border border-gray-700/30">
            {code}
          </code>
        );
      }
      // Check for bold
      const boldParts = part.split(/(\*\*[^*]+\*\*)/);
      return boldParts.map((boldPart, bidx) => {
        if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
          return <strong key={`${idx}-${bidx}`} className="font-semibold text-white">{boldPart.slice(2, -2)}</strong>;
        }
        return <span key={`${idx}-${bidx}`}>{boldPart}</span>;
      });
    });

    return (
      <p key={elements.length} className="text-gray-300 leading-relaxed mb-5">
        {formattedParts}
      </p>
    );
  };

  lines.forEach((line, idx) => {
    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        if (codeBlockContent.length > 0) {
          elements.push(
            <CodeBlock key={elements.length} language={codeBlockLanguage} code={codeBlockContent} />
          );
        }
        codeBlockContent = [];
        codeBlockLanguage = '';
        inCodeBlock = false;
      } else {
        // Start code block
        codeBlockLanguage = line.slice(3).trim() || 'text';
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // Headers
    if (line.startsWith('### ')) {
      if (currentParagraph.length > 0) {
        elements.push(renderParagraph(currentParagraph.join(' ')));
        currentParagraph = [];
      }
      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={elements.length} className="list-disc list-inside mb-5 space-y-2 text-gray-300 ml-4">
            {listItems.map((item, i) => (
              <li key={i} className="leading-relaxed">{item.replace(/^[-*]\s*/, '')}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
      elements.push(
        <h3 key={idx} className="text-lg font-semibold text-white mt-8 mb-4 flex items-center gap-2">
          <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
          {line.slice(4)}
        </h3>
      );
      return;
    }

    if (line.startsWith('## ')) {
      if (currentParagraph.length > 0) {
        elements.push(renderParagraph(currentParagraph.join(' ')));
        currentParagraph = [];
      }
      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={elements.length} className="list-disc list-inside mb-5 space-y-2 text-gray-300 ml-4">
            {listItems.map((item, i) => (
              <li key={i} className="leading-relaxed">{item.replace(/^[-*]\s*/, '')}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
      elements.push(
        <h2 key={idx} className="text-2xl font-bold text-white mt-10 mb-5 pb-3 border-b border-gray-800/50">
          {line.slice(3)}
        </h2>
      );
      return;
    }

    // Lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (currentParagraph.length > 0) {
        elements.push(renderParagraph(currentParagraph.join(' ')));
        currentParagraph = [];
      }
      inList = true;
      listItems.push(line.trim());
      return;
    }

    // Regular paragraph
    if (line.trim()) {
      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={elements.length} className="list-disc list-inside mb-5 space-y-2 text-gray-300 ml-4">
            {listItems.map((item, i) => (
              <li key={i} className="leading-relaxed">{item.replace(/^[-*]\s*/, '')}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
      currentParagraph.push(line);
    } else {
      if (currentParagraph.length > 0) {
        elements.push(renderParagraph(currentParagraph.join(' ')));
        currentParagraph = [];
      }
    }
  });

  // Handle remaining content
  if (currentParagraph.length > 0) {
    elements.push(renderParagraph(currentParagraph.join(' ')));
  }
  if (inList && listItems.length > 0) {
    elements.push(
      <ul key={elements.length} className="list-disc list-inside mb-5 space-y-2 text-gray-300 ml-4">
        {listItems.map((item, i) => (
          <li key={i} className="leading-relaxed">{item.replace(/^[-*]\s*/, '')}</li>
        ))}
      </ul>
    );
  }
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <CodeBlock key={elements.length} language={codeBlockLanguage} code={codeBlockContent} />
    );
  }

  return <div>{elements}</div>;
}

// Parse API endpoints from content
const parseAPIEndpoints = (content: string) => {
  const endpoints: Array<{ method: string; path: string; description?: string }> = [];
  const lines = content.split('\n');
  let currentCategory = '';
  let inHttpBlock = false;
  let httpBlockContent: string[] = [];
  
  lines.forEach((line, idx) => {
    // Check for category headers
    if (line.startsWith('### ')) {
      currentCategory = line.slice(4);
    }
    
    // Check for HTTP code block start
    if (line.trim().startsWith('```http')) {
      inHttpBlock = true;
      httpBlockContent = [];
      return;
    }
    
    // Check for code block end
    if (line.trim() === '```' && inHttpBlock) {
      // Parse HTTP block content
      httpBlockContent.forEach(httpLine => {
        const match = httpLine.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(.+)$/);
        if (match) {
          endpoints.push({
            method: match[1],
            path: match[2].trim(),
            description: currentCategory || undefined
          });
        }
      });
      inHttpBlock = false;
      httpBlockContent = [];
      return;
    }
    
    // Collect HTTP block content
    if (inHttpBlock) {
      httpBlockContent.push(line);
    }
  });
  
  return endpoints;
};

export default function DocsPage() {
  const [selectedSection, setSelectedSection] = useState<string>("overview");
  const [selectedSubsection, setSelectedSubsection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const currentSection = documentationSections.find(s => s.id === selectedSection);
  const currentSubsection = currentSection?.subsections?.find(s => s.id === selectedSubsection);
  const displayContent = currentSubsection || currentSection;

  // Parse API endpoints if viewing API section
  const apiEndpoints = useMemo(() => {
    if (currentSubsection?.id === 'api' || currentSection?.id === 'advanced') {
      return parseAPIEndpoints(currentSubsection?.content || currentSection?.content || '');
    }
    return [];
  }, [currentSubsection, currentSection]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return documentationSections;
    
    const query = searchQuery.toLowerCase();
    return documentationSections.filter(section => {
      if (section.title.toLowerCase().includes(query) || 
          section.content.toLowerCase().includes(query)) {
        return true;
      }
      return section.subsections?.some(sub => 
        sub.title.toLowerCase().includes(query) || 
        sub.content.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  const handleSectionClick = (sectionId: string) => {
    setSelectedSection(sectionId);
    setSelectedSubsection(null);
  };

  const handleSubsectionClick = (subsectionId: string) => {
    setSelectedSubsection(subsectionId);
  };

  // Extract key info from API content
  const extractAPIInfo = (content: string) => {
    const baseURLMatch = content.match(/Base URL[\s\S]*?```\s*\n([^\n]+)/);
    const authMatch = content.match(/Authentication[\s\S]*?```http\s*\n([^\n]+)/);
    const rateLimitMatch = content.match(/Rate Limits[\s\S]*?(- \*\*[^\*]+\*\*: [^\n]+)/g);
    
    return {
      baseURL: baseURLMatch?.[1] || '',
      auth: authMatch?.[1] || '',
      rateLimits: rateLimitMatch?.map(m => m.replace(/^-\s*\*\*|\*\*:\s*/g, '')) || []
    };
  };

  const apiInfo = useMemo(() => {
    if (currentSubsection?.id === 'api') {
      return extractAPIInfo(currentSubsection.content);
    }
    return null;
  }, [currentSubsection]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 bg-gray-950 border-r border-gray-800/30 flex-shrink-0">
          <div className="sticky top-0 h-screen overflow-y-auto scrollbar-hide">
            <div className="p-5 space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-gray-800/30">
                <div className="w-10 h-10 rounded-xl bg-gray-900/40 flex items-center justify-center border border-gray-800/30">
                  <FiBook className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Documentation</h2>
                  <p className="text-xs text-gray-400">v1.0.0</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <FiSearch className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-900/40 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-gray-800/30"
                />
              </div>

              {/* Navigation */}
              <nav className="space-y-1">
                {filteredSections.map((section) => (
                  <div key={section.id}>
                    <button
                      onClick={() => handleSectionClick(section.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                        selectedSection === section.id
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "text-gray-300 hover:bg-gray-800/50"
                      }`}
                    >
                      <span className="font-medium">{section.title}</span>
                      {section.subsections && section.subsections.length > 0 && (
                        <FiChevronRight
                          className={`w-4 h-4 transition-transform ${
                            selectedSection === section.id ? "rotate-90" : ""
                          }`}
                        />
                      )}
                    </button>
                    
                    {/* Subsections */}
                    <AnimatePresence>
                      {selectedSection === section.id && section.subsections && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="ml-4 mt-1.5 space-y-1"
                        >
                          {section.subsections.map((subsection) => (
                            <button
                              key={subsection.id}
                              onClick={() => handleSubsectionClick(subsection.id)}
                              className={`w-full text-left px-3.5 py-2 rounded-lg text-xs transition-all ${
                                selectedSubsection === subsection.id
                                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                  : "text-gray-400 hover:bg-gray-800/50"
                              }`}
                            >
                              {subsection.title}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </nav>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
            {currentSubsection ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Header */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                    <span>{currentSection?.title}</span>
                    <FiChevronRight className="w-3 h-3" />
                    <span>{currentSubsection.title}</span>
                  </div>
                  <h1 className="text-4xl font-bold text-white mb-3">
                    {currentSubsection.title}
                  </h1>
                </div>

                {/* API Info Cards (for API section) */}
                {apiInfo && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <InfoCard icon={FiGlobe} title="Base URL">
                      <code className="text-blue-400 font-mono text-xs break-all">{apiInfo.baseURL}</code>
                    </InfoCard>
                    <InfoCard icon={FiShield} title="Authentication">
                      <code className="text-gray-300 font-mono text-xs">{apiInfo.auth}</code>
                    </InfoCard>
                    <InfoCard icon={FiZap} title="Rate Limits">
                      <div className="space-y-1.5">
                        {apiInfo.rateLimits.map((limit, idx) => (
                          <div key={idx} className="text-xs">{limit}</div>
                        ))}
                      </div>
                    </InfoCard>
                  </div>
                )}

                {/* API Endpoints Grid */}
                {apiEndpoints.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white mb-5 flex items-center gap-2">
                      <FiLink className="w-5 h-5 text-blue-400" />
                      API Endpoints
                    </h2>
                    <div className="grid grid-cols-1 gap-3">
                      {apiEndpoints.map((endpoint, idx) => (
                        <APIEndpointCard
                          key={idx}
                          method={endpoint.method}
                          path={endpoint.path}
                          description={endpoint.description}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Content */}
                <div className="prose prose-invert max-w-none">
                  <MarkdownRenderer content={currentSubsection.content} />
                </div>

                {/* Code Examples */}
                {currentSubsection.codeExamples && currentSubsection.codeExamples.length > 0 && (
                  <div className="mt-10">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                      <FiCode className="w-5 h-5 text-blue-400" />
                      Code Examples
                    </h2>
                    <div className="space-y-6">
                      {currentSubsection.codeExamples.map((example, idx) => {
                        const [copied, setCopied] = useState(false);
                        return (
                          <div key={idx} className="bg-gray-900/40 rounded-xl p-6 border border-gray-800/30">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                  <FiCode className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-white">{example.language}</span>
                                    <Badge variant="info">Example</Badge>
                                  </div>
                                  {example.description && (
                                    <p className="text-xs text-gray-400 mt-1">{example.description}</p>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(example.code);
                                  setCopied(true);
                                  setTimeout(() => setCopied(false), 2000);
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all"
                              >
                                {copied ? (
                                  <>
                                    <FiCheck className="w-4 h-4 text-emerald-400" />
                                    <span className="text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <FiCopy className="w-4 h-4" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="relative">
                              <pre className="bg-gray-900/80 rounded-xl p-5 overflow-x-auto border border-gray-800/50">
                                <code className="text-sm text-gray-100 font-mono whitespace-pre leading-relaxed">
                                  {example.code}
                                </code>
                              </pre>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : currentSection ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h1 className="text-4xl font-bold text-white mb-6">
                  {currentSection.title}
                </h1>
                
                <div className="prose prose-invert max-w-none">
                  <MarkdownRenderer content={currentSection.content} />
                </div>

                {currentSection.subsections && currentSection.subsections.length > 0 && (
                  <div className="mt-10">
                    <h2 className="text-2xl font-bold text-white mb-6">Topics</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentSection.subsections.map((subsection) => (
                        <button
                          key={subsection.id}
                          onClick={() => handleSubsectionClick(subsection.id)}
                          className="text-left p-5 bg-gray-900/40 rounded-xl hover:bg-gray-900/60 transition-all border border-gray-800/30 hover:border-gray-700/50 group"
                        >
                          <h3 className="text-base font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                            {subsection.title}
                          </h3>
                          <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                            {subsection.content.substring(0, 120)}...
                          </p>
                          <div className="flex items-center gap-2 mt-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>Read more</span>
                            <FiChevronRight className="w-3 h-3" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">No documentation found.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
