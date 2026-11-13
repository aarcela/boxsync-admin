'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ArrowUp, Maximize2, RotateCcw, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { isSpotterPage, spotterSuggestions, toDashboardPath } from '@/lib/ai/spotter';
import SpotterMark from './SpotterMark';
import { useSpotter } from './SpotterContext';

type Action = { label: string; href: string };

const LINK_RE = /\[([^\]\n]{1,60})\]\(([^)\s]+)\)/g;

/** Pull whitelisted dashboard links out as action buttons; unknown links fall back to their text. */
function splitAnswer(text: string, streaming: boolean): { body: string; actions: Action[] } {
  const actions: Action[] = [];
  let body = text.replace(LINK_RE, (_match, label: string, href: string) => {
    if (isSpotterPage(href)) {
      if (actions.length < 3 && !actions.some((a) => a.href === href)) {
        actions.push({ label: label.trim(), href });
      }
      return '';
    }
    return label;
  });
  if (streaming) body = body.replace(/\[[^\]\n]*(\]\([^)\n]*)?$/, '');
  body = body.replace(/^[ \t]*[*-][ \t]+/gm, '• ').replace(/\n{3,}/g, '\n\n').trim();
  return { body, actions };
}

function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
        const m = /^\*\*([^*]+)\*\*$/.exec(part);
        return m ? (
          <strong key={i} className="font-bold">
            {m[1]}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

export default function SpotterChat({
  variant,
  onClose,
  onExpand,
}: {
  variant: 'panel' | 'page';
  onClose?: () => void;
  onExpand?: () => void;
}) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { messages, sending, quota, blocked, ask, reset } = useSpotter();
  const [question, setQuestion] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestions = spotterSuggestions(toDashboardPath(pathname));
  const empty = messages.length === 0;
  const lowQuota =
    quota && !quota.disabled && quota.limit > 0 && quota.remaining <= Math.max(5, Math.ceil(quota.limit * 0.25));

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [question]);

  const send = (text: string) => {
    if (!text.trim() || sending || blocked) return;
    setQuestion('');
    void ask(text);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(question);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(question);
    }
  };

  const iconBtn =
    'h-9 w-9 items-center justify-center rounded-lg text-pits-shell-ink-muted hover:text-pits-shell-ink hover:bg-white/10';

  return (
    <div className="flex h-full min-h-0 flex-col bg-pits-surface-elevated">
      <header className="shrink-0 flex items-center gap-3 bg-pits-shell px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pits-shell-accent text-pits-dark-text">
          <SpotterMark size={20} strokeWidth={2.6} animate={sending ? 'loop' : 'draw'} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black italic uppercase tracking-tight leading-none text-pits-shell-ink">
            {t('Spotter')}
          </p>
          <p className="mt-1 truncate text-xs text-pits-shell-ink-muted">
            {quota?.disabled
              ? t('Ask AI is disabled for this box.')
              : lowQuota
                ? t('Spotter questions left', { count: quota.remaining })
                : t('Spotter tagline')}
          </p>
        </div>
        {!empty ? (
          <button type="button" onClick={reset} disabled={sending} className={`inline-flex ${iconBtn}`} aria-label={t('Spotter new chat')} title={t('Spotter new chat')}>
            <RotateCcw size={16} />
          </button>
        ) : null}
        {onExpand ? (
          <button type="button" onClick={onExpand} className={`hidden sm:inline-flex ${iconBtn}`} aria-label={t('Spotter expand')} title={t('Spotter expand')}>
            <Maximize2 size={16} />
          </button>
        ) : null}
        {onClose ? (
          <button type="button" onClick={onClose} className={`inline-flex ${iconBtn}`} aria-label={t('Close')} title={t('Close')}>
            <X size={18} />
          </button>
        ) : null}
      </header>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto bg-pits-surface px-4 py-4" aria-live="polite">
        <div className={`mx-auto flex flex-col gap-3 ${variant === 'page' ? 'max-w-2xl' : ''}`}>
          {empty ? (
            <div className="spotter-in flex flex-col items-start gap-3 pt-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pits-shell text-pits-shell-accent">
                <SpotterMark size={26} animate="draw" />
              </span>
              <p className="text-sm font-semibold text-pits-text">{t('Spotter empty')}</p>
            </div>
          ) : null}
          {messages.map((message, index) => {
            if (message.role === 'user') {
              return (
                <div key={index} className="spotter-in self-end max-w-[85%] rounded-2xl rounded-br-md bg-pits-ink px-3.5 py-2.5 text-sm leading-6 text-pits-surface-elevated whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              );
            }
            const streaming = sending && index === messages.length - 1;
            const { body, actions } = splitAnswer(message.content, streaming);
            return (
              <div key={index} className="spotter-in self-start max-w-[92%] rounded-2xl rounded-bl-md border border-pits-border bg-pits-surface-elevated px-3.5 py-2.5 text-sm leading-6 text-pits-text">
                {body ? (
                  <div className="whitespace-pre-wrap break-words">
                    <Bold text={body} />
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-2 py-0.5 text-xs font-semibold text-pits-dim" role="status">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pits-shell text-pits-shell-accent">
                      <SpotterMark size={14} strokeWidth={2.8} animate="loop" />
                    </span>
                    {t('Ask AI thinking')}
                  </span>
                )}
                {actions.length > 0 && !streaming ? (
                  <div className="spotter-stagger mt-2.5 flex flex-col gap-1.5">
                    {actions.map((action, i) => (
                      <Link
                        key={action.href + i}
                        href={action.href}
                        onClick={() => {
                          if (variant === 'panel' && window.innerWidth < 640) onClose?.();
                        }}
                        className={`group flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 text-sm font-semibold ${
                          i === 0
                            ? 'bg-pits-primary-soft text-pits-primary-dark hover:bg-pits-primary hover:text-pits-dark-text'
                            : 'border border-pits-border text-pits-text hover:border-pits-primary'
                        }`}
                      >
                        <span className="truncate">{action.label}</span>
                        <ArrowRight size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-pits-border bg-pits-surface-elevated">
        {!sending && !blocked ? (
          <div className="spotter-stagger flex gap-2 overflow-x-auto px-3 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {suggestions.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => send(t(key))}
                className="shrink-0 min-h-9 rounded-full border border-pits-border bg-pits-surface-elevated px-3.5 text-xs font-semibold text-pits-text hover:border-pits-primary hover:bg-pits-primary-soft"
              >
                {t(key)}
              </button>
            ))}
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="flex items-end gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <label htmlFor={`spotter-input-${variant}`} className="sr-only">
            {t('Spotter placeholder')}
          </label>
          <textarea
            id={`spotter-input-${variant}`}
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={1000}
            rows={1}
            disabled={blocked}
            placeholder={t('Spotter placeholder')}
            className="flex-1 min-h-11 resize-none rounded-xl border border-pits-border bg-pits-surface px-3.5 py-2.5 text-base sm:text-sm leading-6 text-pits-text placeholder:text-pits-dim outline-none focus:border-pits-primary focus:ring-2 focus:ring-pits-primary/30 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || blocked || !question.trim()}
            aria-label={t('Ask AI send')}
            className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-xl bg-pits-shell-accent text-pits-dark-text disabled:opacity-40"
          >
            <ArrowUp size={20} strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  );
}
