'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { useToast } from '@/components/Toast';
import { toDashboardPath } from '@/lib/ai/spotter';
import type { AskAiQuota } from '@/lib/ai/quota';

export type SpotterMessage = { role: 'user' | 'assistant'; content: string };

type SpotterContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  messages: SpotterMessage[];
  sending: boolean;
  quota: AskAiQuota | null;
  blocked: boolean;
  ask: (text: string) => Promise<void>;
  reset: () => void;
};

const SpotterContext = createContext<SpotterContextValue | null>(null);

const KNOWN_ERRORS = new Set([
  'Ask AI monthly limit reached.',
  'Ask AI is disabled for this box.',
  'Ask AI is unavailable.',
]);

/** Drop saved Spotter chats in this tab (on sign-out, so the next staff member starts clean). */
export function clearSpotterChats() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('wodus-spotter:')) sessionStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable */
  }
}

const noopSubscribe = () => () => {};
const NO_MESSAGES: SpotterMessage[] = [];

function readStored(key: string): SpotterMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is SpotterMessage =>
        !!m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    );
  } catch {
    return [];
  }
}

export function SpotterProvider({ children }: { children: React.ReactNode }) {
  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const { slug } = useTenant();
  const pathname = usePathname();
  const storageKey = `wodus-spotter:${slug}`;

  const [open, setOpen] = useState(false);
  const [storedMessages, setMessages] = useState<SpotterMessage[]>(() => readStored(storageKey));
  // Server and hydration render show an empty chat; the restored one appears right after.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const messages = hydrated ? storedMessages : NO_MESSAGES;
  const [sending, setSending] = useState(false);
  const [quota, setQuota] = useState<AskAiQuota | null>(null);
  const quotaLoaded = useRef(false);

  useEffect(() => {
    if (sending) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(storedMessages.slice(-30)));
    } catch {
      /* storage unavailable */
    }
  }, [storedMessages, sending, storageKey]);

  useEffect(() => {
    if (!open || quotaLoaded.current) return;
    quotaLoaded.current = true;
    void fetch('/api/admin/ask', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { quota?: AskAiQuota } | null) => {
        if (data?.quota) setQuota(data.quota);
      })
      .catch(() => {
        quotaLoaded.current = false;
      });
  }, [open]);

  const blocked = Boolean(quota && (quota.disabled || quota.remaining <= 0));

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || sending) return;
      if (quota?.disabled) {
        toast(t('Ask AI is disabled for this box.'), 'error');
        return;
      }
      if (quota && quota.remaining <= 0) {
        toast(t('Ask AI monthly limit reached.'), 'error');
        return;
      }

      const history = messages.filter((m) => m.content.trim());
      setSending(true);
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: question },
        { role: 'assistant', content: '' },
      ]);

      const fail = (key: string) => {
        setMessages((prev) => prev.slice(0, -2));
        toast(t(KNOWN_ERRORS.has(key) ? (key as Parameters<typeof t>[0]) : 'Could not ask AI.'), 'error');
      };

      try {
        const res = await fetch('/api/admin/ask', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            history,
            language: lang,
            page: toDashboardPath(pathname),
          }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          if (data.quota) setQuota(data.quota);
          fail(typeof data.error === 'string' ? data.error : '');
          return;
        }

        const header = res.headers.get('X-Ask-Quota');
        if (header) {
          try {
            setQuota(JSON.parse(header) as AskAiQuota);
          } catch {
            /* ignore */
          }
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let answer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          answer += decoder.decode(value, { stream: true });
          const snapshot = answer;
          setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: snapshot }]);
        }
        answer += decoder.decode();

        if (!answer.trim()) {
          quotaLoaded.current = false;
          fail('Ask AI is unavailable.');
          return;
        }
        setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: answer }]);
      } catch {
        fail('');
      } finally {
        setSending(false);
      }
    },
    [lang, messages, pathname, quota, sending, t, toast]
  );

  const reset = useCallback(() => {
    if (sending) return;
    setMessages([]);
  }, [sending]);

  const value = useMemo<SpotterContextValue>(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen((v) => !v),
      messages,
      sending,
      quota,
      blocked,
      ask,
      reset,
    }),
    [open, messages, sending, quota, blocked, ask, reset]
  );

  return <SpotterContext.Provider value={value}>{children}</SpotterContext.Provider>;
}

export function useSpotter(): SpotterContextValue {
  const ctx = useContext(SpotterContext);
  if (!ctx) throw new Error('useSpotter must be used inside SpotterProvider');
  return ctx;
}
