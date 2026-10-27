import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type SidebarMode = 'expanded' | 'mini' | 'hidden';

export interface SidebarContextType {
  mode: SidebarMode;
  setMode: (mode: SidebarMode) => void;
  lastVisibleMode: 'expanded' | 'mini';
  toggleMini: () => void;
  hide: () => void;
  show: () => void;
  toggleHidden: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const STORAGE_KEY_MODE = 'sidebar_mode';
const STORAGE_KEY_LAST_VISIBLE = 'sidebar_last_visible';

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read initial mode from localStorage with fallback to 'expanded'
  const [mode, setModeState] = useState<SidebarMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MODE);
      if (saved === 'expanded' || saved === 'mini' || saved === 'hidden') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'expanded';
  });

  // Read initial last visible mode with fallback to 'expanded'
  const [lastVisibleMode, setLastVisibleModeState] = useState<'expanded' | 'mini'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_VISIBLE);
      if (saved === 'expanded' || saved === 'mini') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'expanded';
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  // Synchronize mode and localStorage
  const setMode = useCallback((newMode: SidebarMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY_MODE, newMode);
      if (newMode === 'expanded' || newMode === 'mini') {
        localStorage.setItem(STORAGE_KEY_LAST_VISIBLE, newMode);
        setLastVisibleModeState(newMode);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Toggle between expanded and mini modes
  const toggleMini = useCallback(() => {
    setModeState((current) => {
      const next: 'expanded' | 'mini' = current === 'mini' ? 'expanded' : 'mini';
      try {
        localStorage.setItem(STORAGE_KEY_MODE, next);
        localStorage.setItem(STORAGE_KEY_LAST_VISIBLE, next);
      } catch {
        // ignore
      }
      setLastVisibleModeState(next);
      return next;
    });
  }, []);

  // Hide sidebar completely (mode = 'hidden')
  const hide = useCallback(() => {
    setModeState((current) => {
      if (current === 'expanded' || current === 'mini') {
        try {
          localStorage.setItem(STORAGE_KEY_LAST_VISIBLE, current);
        } catch {
          // ignore
        }
        setLastVisibleModeState(current);
      }
      try {
        localStorage.setItem(STORAGE_KEY_MODE, 'hidden');
      } catch {
        // ignore
      }
      return 'hidden';
    });
  }, []);

  // Show sidebar restoring last visible mode
  const show = useCallback(() => {
    let target = lastVisibleMode;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_VISIBLE);
      if (saved === 'expanded' || saved === 'mini') {
        target = saved;
      }
    } catch {
      // ignore
    }
    setModeState(target);
    try {
      localStorage.setItem(STORAGE_KEY_MODE, target);
    } catch {
      // ignore
    }
  }, [lastVisibleMode]);

  // Toggle hidden vs visible
  const toggleHidden = useCallback(() => {
    setModeState((current) => {
      if (current === 'hidden') {
        const target = lastVisibleMode || 'expanded';
        try {
          localStorage.setItem(STORAGE_KEY_MODE, target);
        } catch {
          // ignore
        }
        return target;
      } else {
        try {
          localStorage.setItem(STORAGE_KEY_LAST_VISIBLE, current);
          localStorage.setItem(STORAGE_KEY_MODE, 'hidden');
        } catch {
          // ignore
        }
        setLastVisibleModeState(current);
        return 'hidden';
      }
    });
  }, [lastVisibleMode]);

  // Global keyboard shortcut: Ctrl+B / Cmd+B toggles sidebar visibility
  // Also Escape key closes mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar visibility via Ctrl+B or Cmd+B
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggleHidden();
      }

      // Close mobile drawer on Escape
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHidden]);

  // Mobile body scroll locking
  useEffect(() => {
    if (mobileOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [mobileOpen]);

  // Auto-close mobile drawer when viewport resized to desktop (>= 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        mode,
        setMode,
        lastVisibleMode,
        toggleMini,
        hide,
        show,
        toggleHidden,
        mobileOpen,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = (): SidebarContextType => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export default SidebarContext;
