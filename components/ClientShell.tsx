'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MotionConfig, AnimatePresence, motion } from 'framer-motion';
import {
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Paperclip,
  WifiOff,
  AlertTriangle,
  Award,
  X,
  ShieldAlert,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { playSound, syncHowlerMute } from '@/lib/audio';
import { flushSyncQueue, scheduleSyncFlush } from '@/lib/sync';
import { BADGES } from '@/data/questions';
import { getRankForXp } from '@/lib/xp';
import { Stamp } from '@/components/ui/Stamp';

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const [sepiaToast, setSepiaToast] = useState(false);
  const [principalsOpen, setPrincipalsOpen] = useState(false);
  const konamiProgress = useRef<string[]>([]);

  const theme = useAppStore((s) => s.theme);
  const sepiaMode = useAppStore((s) => s.sepiaMode);
  const soundMuted = useAppStore((s) => s.soundMuted);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const toggleSepiaMode = useAppStore((s) => s.toggleSepiaMode);
  const toggleSoundMuted = useAppStore((s) => s.toggleSoundMuted);
  const contributor = useAppStore((s) => s.contributor);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const syncQueue = useAppStore((s) => s.syncQueue);
  const setSyncStatus = useAppStore((s) => s.setSyncStatus);
  const xpFloats = useAppStore((s) => s.xpFloats);
  const dismissXpFloat = useAppStore((s) => s.dismissXpFloat);
  const badgePopQueue = useAppStore((s) => s.badgePopQueue);
  const dismissBadgePop = useAppStore((s) => s.dismissBadgePop);
  const caseMeta = useAppStore((s) => s.caseMeta);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Apply theme & sepia to <html>
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute('data-theme', theme);
    if (sepiaMode) {
      document.documentElement.setAttribute('data-sepia', 'true');
    } else {
      document.documentElement.removeAttribute('data-sepia');
    }
  }, [theme, sepiaMode, hydrated]);

  // Sync Howler mute state
  useEffect(() => {
    if (!hydrated) return;
    void syncHowlerMute(soundMuted);
  }, [soundMuted, hydrated]);

  // Trigger sync flush when queue updates or network recovers
  useEffect(() => {
    if (!hydrated) return;
    if (syncQueue.length > 0) {
      scheduleSyncFlush(600);
    }
  }, [syncQueue.length, hydrated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      void flushSyncQueue();
    };
    const handleOffline = () => {
      setSyncStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) setSyncStatus('offline');
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setSyncStatus]);

  // Auto-dismiss XP floats
  useEffect(() => {
    if (xpFloats.length === 0) return;
    const timer = setTimeout(() => {
      dismissXpFloat(xpFloats[0].id);
    }, 1800);
    return () => clearTimeout(timer);
  }, [xpFloats, dismissXpFloat]);

  // Konami code listener -> Principal's Office Easter Egg
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const next = [...konamiProgress.current, key].slice(-KONAMI.length);
      konamiProgress.current = next;
      if (
        next.length === KONAMI.length &&
        next.every((val, idx) => val === KONAMI[idx])
      ) {
        setPrincipalsOpen(true);
        void playSound('chime');
        konamiProgress.current = [];
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogoTap = () => {
    const next = logoTaps + 1;
    if (next >= 7) {
      toggleSepiaMode();
      setLogoTaps(0);
      setSepiaToast(true);
      void playSound('stamp');
      setTimeout(() => setSepiaToast(false), 2600);
    } else {
      setLogoTaps(next);
    }
  };

  const activeBadge =
    badgePopQueue.length > 0
      ? BADGES.find((b) => b.id === badgePopQueue[0])
      : null;

  const rankInfo = getRankForXp(contributor?.xp ?? 0);
  const filedCount = Object.values(caseMeta).filter((c) => c.status === 'filed').length;
  const skippedCount = Object.values(caseMeta).filter((c) => c.status === 'skipped').length;
  const handledCount = filedCount + skippedCount;
  const isEditorRoute = pathname?.startsWith('/editor');
  const xpPct =
    contributor && rankInfo.nextRank
      ? Math.max(
          5,
          Math.min(
            100,
            Math.round(
              ((contributor.xp - rankInfo.current.minXp) /
                Math.max(1, rankInfo.nextRank.minXp - rankInfo.current.minXp)) *
                100
            )
          )
        )
      : 100;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col overflow-x-clip">
        {/* Top Bar (Retro Game + Spatial Frosted HUD) */}
        <header className="sticky top-0 z-40 border-b-2 border-[var(--border-ink)] bg-[var(--manila)]/92 backdrop-blur-md shadow-[0_3px_0_var(--shadow-paper)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-1 px-2 py-1.5 sm:gap-2 sm:px-5 sm:py-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <button
                type="button"
                onClick={handleLogoTap}
                title="Case File: Class of 23 (try tapping 7 times)"
                className="flex min-h-[44px] items-center gap-1.5 rounded px-0.5 text-left sm:gap-2 sm:px-1.5"
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border-2 border-[var(--border-ink)] bg-[var(--stamp-red)] font-stamp text-xs text-white shadow-[1px_2px_0_var(--border-ink)] sm:h-8 sm:w-8 sm:text-sm">
                  23
                </span>
                <span className="font-typewriter truncate text-xs font-bold tracking-tight min-[400px]:hidden">
                  CASE 23
                </span>
                <span className="font-typewriter hidden truncate text-sm font-bold tracking-tight min-[400px]:inline sm:text-base">
                  CASE FILE: 23
                </span>
              </button>
              {hydrated && contributor && !isEditorRoute && (
                <Link
                  href="/desk"
                  className="hidden sm:inline-flex min-h-[44px] items-center gap-1.5 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-2.5 text-xs font-bold shadow-[0_2px_0_var(--btn-shadow)] hover:bg-[var(--highlighter)] hover:text-[#1B1B1B]"
                >
                  <span>Desk</span>
                  <span className="font-mono-doc rounded bg-[var(--manila-dark)] px-1.5 py-0.5 text-[11px]">
                    {handledCount}/22
                  </span>
                </Link>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {/* Sync Paperclip Indicator */}
              {hydrated && contributor && !isEditorRoute && (
                <button
                  type="button"
                  onClick={() => void flushSyncQueue()}
                  aria-label={`Sync status: ${syncStatus}`}
                  className="font-mono-doc inline-flex h-[44px] items-center justify-center gap-1 rounded border-2 border-[var(--border-ink)]/60 bg-[var(--paper)] px-1.5 text-[11px] font-bold sm:px-2"
                >
                  {syncStatus === 'offline' ? (
                    <>
                      <WifiOff className="h-3.5 w-3.5 shrink-0 text-[var(--stamp-red)]" />
                      <span className="hidden sm:inline">Offline</span>
                    </>
                  ) : syncStatus === 'error' ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--stamp-red)]" />
                      <span className="hidden sm:inline">Retry</span>
                    </>
                  ) : syncStatus === 'syncing' ? (
                    <>
                      <Paperclip className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--blueprint-ink)]" />
                      <span className="hidden md:inline">Saving…</span>
                    </>
                  ) : (
                    <>
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                      <span className="hidden md:inline">Saved</span>
                    </>
                  )}
                </button>
              )}

              {/* XP Pill */}
              {hydrated && contributor && !isEditorRoute && (
                <Link
                  href="/desk"
                  aria-label={`XP: ${contributor.xp}, Rank: ${rankInfo.current.title}`}
                  className="font-mono-doc inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded border-2 border-[var(--border-ink)] bg-[var(--highlighter)] px-1.5 text-[11px] font-bold text-[#1B1B1B] shadow-[0_2px_0_var(--btn-shadow)] sm:px-2.5 sm:text-xs"
                >
                  <span>{rankInfo.current.badge}</span>
                  <span>{contributor.xp}</span>
                  <span className="hidden min-[375px]:inline">XP</span>
                </Link>
              )}

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() => {
                  const willUnmute = soundMuted;
                  toggleSoundMuted();
                  if (willUnmute) {
                    setTimeout(() => void playSound('chime'), 50);
                  }
                }}
                aria-label={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
                aria-pressed={!soundMuted}
                className="inline-flex h-[44px] w-[38px] min-[375px]:w-[44px] shrink-0 items-center justify-center rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] hover:bg-[var(--manila-dark)]"
              >
                {hydrated && !soundMuted ? (
                  <Volume2 className="h-4 w-4 text-[var(--blueprint-ink)] sm:h-5 sm:w-5" />
                ) : (
                  <VolumeX className="h-4 w-4 text-[var(--ink-muted)] sm:h-5 sm:w-5" />
                )}
              </button>

              {/* Night Shift Theme Toggle */}
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  void playSound('typewriter');
                }}
                aria-label={
                  theme === 'light'
                    ? 'Switch to Night Shift dark mode'
                    : 'Switch to Day Shift light mode'
                }
                className="inline-flex h-[44px] w-[38px] min-[375px]:w-[44px] shrink-0 items-center justify-center rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] hover:bg-[var(--manila-dark)]"
              >
                {hydrated && theme === 'night' ? (
                  <Sun className="h-4 w-4 text-[var(--highlighter)] sm:h-5 sm:w-5" />
                ) : (
                  <Moon className="h-4 w-4 text-[var(--ink)] sm:h-5 sm:w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile + Game Quest HUD Strip */}
          {hydrated && contributor && !isEditorRoute && (
            <div className="border-t border-[var(--border-ink)]/30 bg-[var(--paper)]/75 px-2.5 py-1.5 sm:px-5">
              <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 text-[11px]">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="font-mono-doc shrink-0 rounded border border-[var(--border-ink)]/50 bg-[var(--manila)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]">
                    LVL {rankInfo.current.badge}
                  </span>
                  <span className="truncate font-semibold text-[var(--ink)]">
                    {rankInfo.current.title}
                  </span>
                  <div
                    aria-hidden="true"
                    className="hidden h-2 w-24 overflow-hidden rounded-full border border-[var(--border-ink)]/50 bg-[var(--manila-dark)] min-[400px]:block sm:w-32"
                  >
                    <div
                      className="h-full bg-[var(--blueprint)] transition-all duration-300"
                      style={{ width: `${xpPct}%` }}
                    />
                  </div>
                </div>

                <Link
                  href="/desk"
                  className="font-mono-doc inline-flex shrink-0 items-center gap-1 rounded border border-[var(--border-ink)] bg-[var(--manila)] px-2 py-1 text-[10px] font-bold text-[var(--ink)] hover:bg-[var(--highlighter)] hover:text-[#1B1B1B] sm:hidden"
                >
                  <span>CASE DESK</span>
                  <span className="rounded bg-[var(--paper)] px-1">{handledCount}/22</span>
                </Link>
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <div className="flex-1">{children}</div>

        {/* Footer */}
        <footer className="border-t border-[var(--border-ink)]/25 bg-[var(--manila)]/60 px-4 py-4 text-center text-xs text-[var(--ink-muted)]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
            <span className="font-mono-doc">
              BATCH OF 23 • CONFIDENTIAL KEEPSAKE BUREAU
            </span>
            <div className="flex items-center gap-4">
              <Link href="/health" className="underline hover:text-[var(--ink)]">
                System Health
              </Link>
              <Link href="/editor" className="underline hover:text-[var(--ink)]">
                Editor Desk
              </Link>
            </div>
          </div>
        </footer>

        {/* Floating XP Numbers */}
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2"
        >
          <AnimatePresence>
            {xpFloats.map((ev) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 16, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                className="font-stamp rounded border-2 border-[var(--border-ink)] bg-[var(--highlighter)] px-3 py-1 text-sm text-[#1B1B1B] shadow-[2px_3px_0_var(--border-ink)]"
              >
                +{ev.amount} XP • {ev.label}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Badge Unlock Toast */}
        <AnimatePresence>
          {activeBadge && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              role="status"
              className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper-card)] p-3.5 shadow-[4px_5px_0_var(--border-ink)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{activeBadge.emoji}</span>
                  <div>
                    <p className="font-mono-doc text-[10px] font-bold uppercase tracking-widest text-[var(--stamp-red)]">
                      Badge Unlocked!
                    </p>
                    <p className="font-typewriter text-base font-bold">
                      {activeBadge.title}
                    </p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {activeBadge.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissBadgePop}
                  aria-label="Dismiss badge notification"
                  className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--manila)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sepia Easter Egg Toast */}
        <AnimatePresence>
          {sepiaToast && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-4 py-2 font-mono-doc text-xs font-bold shadow-lg"
            >
              🕵️ {sepiaMode ? 'Sepia Detective Mode ENGAGED (1974 Archive)' : 'Returned to Standard Case Lighting'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Konami Secret Principal's Office Modal */}
        <AnimatePresence>
          {principalsOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="principals-office-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                className="w-full max-w-md rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper-card)] p-5 shadow-[6px_7px_0_var(--border-ink)]"
              >
                <div className="flex items-start justify-between">
                  <Stamp text="CLASSIFIED: PRINCIPAL'S OFFICE" color="red" size="sm" />
                  <button
                    type="button"
                    onClick={() => setPrincipalsOpen(false)}
                    aria-label="Close secret Principal's Office"
                    className="inline-flex h-10 w-10 items-center justify-center rounded border border-[var(--border-ink)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <h2
                  id="principals-office-title"
                  className="font-typewriter mt-3 flex items-center gap-2 text-xl font-bold"
                >
                  <ShieldAlert className="h-5 w-5 text-[var(--stamp-red)]" />
                  You Found the Secret Register
                </h2>
                <p className="mt-2 text-sm text-[var(--ink-muted)]">
                  Konami Code accepted. Welcome behind the frosted glass door where confiscated
                  pens and footballs live.
                </p>
                <div className="font-mono-doc mt-4 space-y-2 rounded border border-dashed border-[var(--border-ink)] bg-[var(--manila)] p-3 text-xs">
                  <p>• Confiscated gel pens in drawer #2: <strong>412</strong></p>
                  <p>• Times Batch 23 said &ldquo;Ma&apos;am just 5 minutes&rdquo;: <strong>1,847</strong></p>
                  <p>• Your current witness rank: <strong>{rankInfo.current.title}</strong></p>
                  <p>• Cases solved by you so far: <strong>{filedCount} / 22</strong></p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                    <Award className="h-4 w-4 text-[var(--blueprint-ink)]" /> Secret tip: tap the &ldquo;23&rdquo; logo 7 times!
                  </span>
                  <button
                    type="button"
                    onClick={() => setPrincipalsOpen(false)}
                    className="tactile-btn rounded bg-[var(--blueprint)] px-4 py-2 text-xs font-bold text-white"
                  >
                    Back to Desk
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
