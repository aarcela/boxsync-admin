'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, User } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import type { AskAiQuota } from '@/lib/ai/quota';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Ask: How does membership expiry work?',
  'Ask: When does a member become solvent?',
  'Ask: How do partial payments work?',
  'Ask: Who can book a class?',
] as const;

export default function AskAiPage() {
  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const [quota, setQuota] = useState<AskAiQuota | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoadingQuota(true);
      try {
        const res = await fetch('/api/admin/ask', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'quota_failed');
        setQuota(data.quota);
      } catch {
        toast(t('Could not load Ask AI quota.'), 'error');
      } finally {
        setLoadingQuota(false);
      }
    };
    void load();
  }, [t, toast]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 48), 140)}px`;
  }, [question]);

  const ask = async (text: string) => {
    const nextQuestion = text.trim();
    if (!nextQuestion || sending) return;
    if (quota?.disabled) {
      toast(t('Ask AI is disabled for this box.'), 'error');
      return;
    }
    if (quota && quota.remaining <= 0) {
      toast(t('Ask AI monthly limit reached.'), 'error');
      return;
    }

    setSending(true);
    setQuestion('');
    const history = messages;
    setMessages((prev) => [...prev, { role: 'user', content: nextQuestion }]);

    try {
      const res = await fetch('/api/admin/ask', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: nextQuestion,
          history,
          language: lang,
        }),
      });
      const data = await res.json();
      if (data.quota) setQuota(data.quota);
      if (!res.ok) {
        setMessages((prev) => prev.slice(0, -1));
        const known =
          data.error === 'Ask AI monthly limit reached.' ||
          data.error === 'Ask AI is disabled for this box.' ||
          data.error === 'Ask AI is unavailable.'
            ? data.error
            : 'Could not ask AI.';
        toast(t(known), 'error');
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
    } catch {
      setMessages((prev) => prev.slice(0, -1));
      toast(t('Could not ask AI.'), 'error');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void ask(question);
    }
  };

  const usedLabel =
    quota == null
      ? '—'
      : quota.disabled
        ? t('Disabled')
        : t('{{used}} of {{limit}} questions this month', {
            used: String(quota.used),
            limit: String(quota.limit),
          });
  const pct =
    quota && quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;
  const atLimit = Boolean(quota && (quota.disabled || quota.remaining <= 0));
  const empty = messages.length === 0 && !sending;

  return (
    <section className="flex-1 min-h-0 flex flex-col rounded-2xl border border-pits-border bg-pits-card shadow-sm overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-pits-border">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pits-primary text-pits-dark-text">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-black italic uppercase tracking-tight text-pits-text leading-none">
              {t('Ask AI')}
            </h1>
            <p className="text-sm text-pits-dim mt-1 truncate">{t('Ask AI subtitle')}</p>
          </div>
        </div>
        <div className="shrink-0 min-w-[9rem] max-w-[14rem]">
          <p className={`text-[11px] font-bold text-right leading-snug ${atLimit ? 'text-red-700' : 'text-pits-dim'}`}>
            {loadingQuota ? '…' : usedLabel}
          </p>
          {quota && !quota.disabled && (
            <div className="mt-2 h-1.5 rounded-full bg-pits-surface overflow-hidden">
              <div
                className={`h-full rounded-full ${pct >= 100 ? 'bg-red-600' : 'bg-pits-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </header>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto bg-pits-surface px-5 py-6">
        {empty ? (
          <div className="h-full max-w-xl mx-auto flex flex-col justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pits-primary text-pits-dark-text mb-4">
              <Bot size={28} />
            </div>
            <p className="text-xl font-black italic uppercase tracking-tight text-pits-text">
              {t('Ask AI empty')}
            </p>
            <p className="text-sm text-pits-dim mt-2 max-w-md">{t('Ask AI subtitle')}</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              {SUGGESTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={sending || atLimit}
                  onClick={() => void ask(t(key))}
                  className="text-left text-sm font-medium px-4 py-3.5 rounded-xl border border-pits-border bg-pits-card text-pits-text hover:border-pits-primary disabled:opacity-50"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-xl mx-auto flex flex-col gap-5 pb-2">
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      isUser
                        ? 'bg-pits-ink text-pits-card'
                        : 'bg-pits-primary text-pits-dark-text'
                    }`}
                  >
                    {isUser ? <User size={16} /> : <Bot size={16} />}
                  </span>
                  <div className={`flex-1 min-w-0 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap break-words ${
                        isUser
                          ? 'bg-pits-ink text-pits-card rounded-tr-md'
                          : 'bg-pits-card border border-pits-border text-pits-text rounded-tl-md'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                </div>
              );
            })}
            {sending ? (
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pits-primary text-pits-dark-text">
                  <Bot size={16} />
                </span>
                <div className="rounded-2xl rounded-tl-md bg-pits-card border border-pits-border px-4 py-3 text-sm text-pits-dim flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {t('Ask AI thinking')}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-pits-border bg-pits-card p-4"
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={1000}
            rows={1}
            disabled={sending || atLimit}
            className="flex-1 min-h-12 resize-none overflow-y-auto px-4 py-3 rounded-xl border border-pits-border bg-pits-surface text-sm leading-6 text-pits-text placeholder:text-pits-dim focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || atLimit || !question.trim()}
            className="h-12 px-5 shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-pits-primary text-pits-dark-text font-bold uppercase tracking-wide text-xs disabled:opacity-40"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {t('Ask AI send')}
          </button>
        </div>
      </form>
    </section>
  );
}
