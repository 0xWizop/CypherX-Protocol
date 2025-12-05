/**
 * CypherX Design System Tokens
 * 
 * Centralized design tokens for consistent UI across all components.
 * Use these values for all dropdowns, modals, and interactive elements.
 */

export const designTokens = {
  // Border Radius
  radius: {
    sm: 'rounded-lg',      // 8px - small elements, tags, badges
    md: 'rounded-xl',      // 12px - cards, list items, inputs
    lg: 'rounded-2xl',     // 16px - modals, dropdowns, containers
    xl: 'rounded-3xl',     // 24px - large feature cards
    full: 'rounded-full',  // Pills, avatars
  },

  // Spacing (Padding & Margin)
  spacing: {
    xs: 'p-2',           // 8px
    sm: 'p-3',           // 12px
    md: 'p-4',           // 16px
    lg: 'p-5',           // 20px
    xl: 'p-6',           // 24px
    // Gap variants
    gapXs: 'gap-1.5',    // 6px
    gapSm: 'gap-2',      // 8px
    gapMd: 'gap-3',      // 12px
    gapLg: 'gap-4',      // 16px
  },

  // Shadows
  shadow: {
    sm: 'shadow-lg',
    md: 'shadow-xl',
    lg: 'shadow-2xl',
    glow: 'shadow-[0_0_30px_rgba(59,130,246,0.1)]',
    dropdownDesktop: 'shadow-2xl shadow-black/40',
    dropdownMobile: 'shadow-none',
    modal: 'shadow-2xl shadow-black/60',
  },

  // Colors (Background)
  bg: {
    primary: 'bg-[#0a0f1a]',         // Main background
    secondary: 'bg-gray-950',         // Modal/dropdown background
    tertiary: 'bg-gray-900/50',       // Card/section background
    elevated: 'bg-gray-900/60',       // Elevated elements
    hover: 'hover:bg-gray-800/50',    // Hover state
    active: 'active:bg-gray-800/70',  // Active/pressed state
    overlay: 'bg-black/70',           // Modal overlay
  },

  // Colors (Border)
  border: {
    default: 'border-gray-800/60',
    subtle: 'border-gray-800/40',
    hover: 'hover:border-gray-700',
    focus: 'focus:border-blue-500/50',
    active: 'border-blue-500/40',
  },

  // Colors (Text)
  text: {
    primary: 'text-white',
    secondary: 'text-gray-300',
    muted: 'text-gray-400',
    subtle: 'text-gray-500',
    accent: 'text-blue-400',
    danger: 'text-red-400',
    success: 'text-green-400',
  },

  // Animation & Transitions
  animation: {
    duration: 'duration-200',
    ease: 'ease-out',
    transition: 'transition-all duration-200 ease-out',
    spring: { type: 'spring', damping: 25, stiffness: 300 },
    fadeIn: { opacity: 0 },
    fadeOut: { opacity: 1 },
  },

  // Typography
  typography: {
    // Headers
    h1: 'text-2xl font-bold',
    h2: 'text-xl font-semibold',
    h3: 'text-lg font-semibold',
    h4: 'text-base font-semibold',
    // Body
    body: 'text-sm',
    bodySmall: 'text-xs',
    // Labels
    label: 'text-xs font-medium uppercase tracking-wide',
    labelSmall: 'text-[10px] font-medium uppercase tracking-[0.2em]',
  },

  // Z-Index
  zIndex: {
    dropdown: 'z-50',
    modal: 'z-[9999]',
    toast: 'z-[10000]',
    overlay: 'z-[9998]',
  },
};

// Composite styles for common patterns
export const compositeStyles = {
  // Dropdown Container (Desktop)
  dropdownDesktop: `
    ${designTokens.bg.secondary}
    ${designTokens.radius.lg}
    ${designTokens.shadow.dropdownDesktop}
    border ${designTokens.border.default}
    backdrop-blur-xl
  `.trim().replace(/\s+/g, ' '),

  // Dropdown Container (Mobile - Full Page)
  dropdownMobile: `
    ${designTokens.bg.secondary}
    w-full h-full
  `.trim().replace(/\s+/g, ' '),

  // Modal Overlay
  modalOverlay: `
    fixed inset-0
    ${designTokens.bg.overlay}
    backdrop-blur-sm
    ${designTokens.zIndex.overlay}
    flex items-center justify-center
  `.trim().replace(/\s+/g, ' '),

  // Modal Container (Desktop)
  modalDesktop: `
    ${designTokens.bg.secondary}
    ${designTokens.radius.lg}
    ${designTokens.shadow.modal}
    border ${designTokens.border.default}
    max-w-lg w-full mx-4
    max-h-[85vh] overflow-hidden
    flex flex-col
  `.trim().replace(/\s+/g, ' '),

  // Modal Container (Mobile - Full Page)
  modalMobile: `
    ${designTokens.bg.secondary}
    w-full h-full
    flex flex-col
  `.trim().replace(/\s+/g, ' '),

  // Section Card
  sectionCard: `
    ${designTokens.bg.tertiary}
    ${designTokens.radius.md}
    border ${designTokens.border.subtle}
    ${designTokens.spacing.md}
  `.trim().replace(/\s+/g, ' '),

  // List Item
  listItem: `
    flex items-center
    ${designTokens.spacing.sm}
    ${designTokens.radius.md}
    ${designTokens.bg.hover}
    ${designTokens.animation.transition}
    cursor-pointer
  `.trim().replace(/\s+/g, ' '),

  // Button Primary
  buttonPrimary: `
    px-4 py-2.5
    ${designTokens.radius.md}
    bg-blue-600 hover:bg-blue-500 active:bg-blue-700
    ${designTokens.text.primary}
    font-medium text-sm
    ${designTokens.animation.transition}
  `.trim().replace(/\s+/g, ' '),

  // Button Secondary
  buttonSecondary: `
    px-4 py-2.5
    ${designTokens.radius.md}
    ${designTokens.bg.tertiary}
    border ${designTokens.border.default}
    ${designTokens.border.hover}
    ${designTokens.text.secondary}
    font-medium text-sm
    ${designTokens.animation.transition}
  `.trim().replace(/\s+/g, ' '),

  // Button Ghost
  buttonGhost: `
    p-2
    ${designTokens.radius.md}
    ${designTokens.bg.hover}
    ${designTokens.text.muted}
    hover:text-white
    ${designTokens.animation.transition}
  `.trim().replace(/\s+/g, ' '),

  // Input Field
  inputField: `
    w-full px-3 py-2.5
    ${designTokens.radius.md}
    bg-gray-900/80
    border ${designTokens.border.default}
    ${designTokens.border.hover}
    focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50
    ${designTokens.text.primary}
    placeholder-gray-500
    text-sm
    ${designTokens.animation.transition}
    outline-none
  `.trim().replace(/\s+/g, ' '),

  // Close Button
  closeButton: `
    w-9 h-9
    flex items-center justify-center
    ${designTokens.radius.md}
    ${designTokens.bg.tertiary}
    border ${designTokens.border.default}
    ${designTokens.border.hover}
    ${designTokens.text.muted}
    hover:text-white
    ${designTokens.animation.transition}
  `.trim().replace(/\s+/g, ' '),

  // Header Bar
  headerBar: `
    flex items-center justify-between
    px-4 sm:px-5 py-3.5
    border-b ${designTokens.border.default}
    ${designTokens.bg.secondary}
    flex-shrink-0
  `.trim().replace(/\s+/g, ' '),

  // Scrollable Content
  scrollableContent: `
    flex-1 overflow-y-auto
    scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent
    px-4 sm:px-5 py-4
  `.trim().replace(/\s+/g, ' '),

  // Footer Bar
  footerBar: `
    flex items-center gap-3
    px-4 sm:px-5 py-4
    border-t ${designTokens.border.default}
    ${designTokens.bg.secondary}
    flex-shrink-0
  `.trim().replace(/\s+/g, ' '),

  // Toggle Switch
  toggleSwitch: `
    w-11 h-6
    rounded-full
    transition-colors duration-200
    flex items-center px-1
  `.trim().replace(/\s+/g, ' '),

  // Badge
  badge: `
    px-2 py-0.5
    ${designTokens.radius.full}
    text-xs font-medium
    bg-blue-500/20 text-blue-400
  `.trim().replace(/\s+/g, ' '),

  // Divider
  divider: `
    border-t ${designTokens.border.subtle}
    my-3
  `.trim().replace(/\s+/g, ' '),
};

// Framer Motion animation presets
export const motionPresets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 },
  },
  
  slideUp: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
    transition: { duration: 0.2, ease: [0, 0, 0.2, 1] as const },
  },

  slideUpMobile: {
    initial: { opacity: 0, y: '100%' },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: '100%' },
    transition: { type: 'spring' as const, damping: 30, stiffness: 300 },
  },

  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.15 },
  },

  dropdownDesktop: {
    initial: { opacity: 0, y: -8, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.98 },
    transition: { duration: 0.15, ease: [0, 0, 0.2, 1] as const },
  },
};

export default designTokens;

