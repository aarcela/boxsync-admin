'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import SpotterChat from './SpotterChat';
import SpotterMark from './SpotterMark';
import { useSpotter } from './SpotterContext';

const INTRO_KEY = 'wodus-spotter-intro-seen';
const noopSubscribe = () => () => {};

function introSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return true;
  }
}

/** Floating Spotter button + panel. Desktop: docked card bottom-right. Phone: bottom sheet. */
export default function SpotterLauncher({ raised = false }: { raised?: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const { open, setOpen, toggle } = useSpotter();
  const onFullPage = pathname.includes('/dashboard/ask');
  const seenStored = useSyncExternalStore(noopSubscribe, introSeen, () => true);
  const [dismissed, setDismissed] = useState(false);
  const showIntro = !seenStored && !dismissed && !open;

  const dismissIntro = () => {
    setDismissed(true);
    try {
      localStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* storage unavailable */
    }
  };

  const openPanel = () => {
    if (!seenStored && !dismissed) dismissIntro();
    setOpen(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (!onFullPage) toggle();
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFullPage, open, setOpen, toggle]);

  useEffect(() => {
    if (onFullPage) setOpen(false);
  }, [onFullPage, setOpen]);

  if (onFullPage) return null;

  const bottom = raised ? 'bottom-20' : 'bottom-5';
  const panelBottom = raised ? 'sm:bottom-20' : 'sm:bottom-5';
  const introBottom = raised ? 'bottom-36' : 'bottom-24';

  return (
    <>
      {open ? (
        <>
          <div className="spotter-backdrop fixed inset-0 z-50 bg-black/40 sm:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-label={t('Spotter')}
            className={`spotter-panel fixed z-50 overflow-hidden border border-pits-border shadow-2xl inset-x-0 bottom-0 h-[85dvh] rounded-t-2xl sm:inset-x-auto sm:right-5 ${panelBottom} sm:h-[min(620px,calc(100dvh-7rem))] sm:w-[400px] sm:rounded-2xl`}
          >
            <SpotterChat
              variant="panel"
              onClose={() => setOpen(false)}
              onExpand={() => {
                setOpen(false);
                router.push('/dashboard/ask');
              }}
            />
          </div>
        </>
      ) : null}

      {showIntro ? (
        <div
          role="status"
          className={`spotter-intro fixed right-5 ${introBottom} z-40 w-[min(300px,calc(100vw-2.5rem))] rounded-2xl border border-pits-shell-edge bg-pits-shell p-4 pr-10 text-pits-shell-ink shadow-xl`}
        >
          <button
            type="button"
            onClick={dismissIntro}
            aria-label={t('Close')}
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-pits-shell-ink-muted hover:bg-white/10 hover:text-pits-shell-ink"
          >
            <X size={16} />
          </button>
          <p className="text-[11px] font-bold uppercase tracking-widest text-pits-shell-accent">{t('Spotter intro kicker')}</p>
          <p className="mt-1 text-lg font-black italic uppercase leading-tight tracking-tight">{t('Spotter intro title')}</p>
          <p className="mt-1.5 text-sm leading-5 text-pits-shell-ink-muted">{t('Spotter intro body')}</p>
          <button
            type="button"
            onClick={openPanel}
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-pits-shell-accent px-3 text-xs font-black uppercase tracking-wider text-pits-dark-text"
          >
            {t('Spotter intro cta')}
            <kbd className="hidden rounded border border-black/20 px-1 font-mono text-[10px] sm:inline">⌘J</kbd>
          </button>
          <span className="absolute -bottom-2 right-6 h-4 w-4 rotate-45 border-b border-r border-pits-shell-edge bg-pits-shell" aria-hidden="true" />
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={openPanel}
          aria-label={t('Open Spotter')}
          title={`${t('Open Spotter')} (⌘J)`}
          className={`spotter-launcher fixed right-5 ${bottom} z-40 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-pits-shell-accent bg-pits-shell text-pits-shell-accent shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pits-primary/40`}
        >
          {showIntro ? (
            <span className="spotter-ring pointer-events-none absolute -inset-0.5 rounded-2xl border-2 border-pits-shell-accent" aria-hidden="true" />
          ) : null}
          <SpotterMark size={28} strokeWidth={2.4} animate="draw" />
        </button>
      ) : null}
    </>
  );
}
