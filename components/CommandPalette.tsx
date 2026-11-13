'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, CornerDownLeft, Loader2, Search, User, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

export type PaletteLink = { name: string; href: string; icon: LucideIcon; group?: string };

type Item =
  | { kind: 'page'; id: string; label: string; hint?: string; icon: LucideIcon; href: string }
  | { kind: 'action'; id: string; label: string; icon: LucideIcon; href: string; command: PaletteCommand }
  | { kind: 'person'; id: string; label: string; hint?: string; href: string };

/** Commands a page can react to while already open (see usePaletteCommand). */
export type PaletteCommand = 'new-athlete' | 'new-class';
export const PALETTE_EVENT = 'wodus:palette-command';

type PersonResult = { id: string; full_name: string | null; email?: string | null; phone?: string | null; role?: string | null };

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function CommandPalette({
  open,
  onClose,
  pages,
}: {
  open: boolean;
  onClose: () => void;
  pages: PaletteLink[];
}) {
  if (!open) return null;
  return <PaletteBody onClose={onClose} pages={pages} />;
}

function PaletteBody({ onClose, pages }: { onClose: () => void; pages: PaletteLink[] }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const q = normalize(query.trim());

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ search: query.trim(), page: '1', pageSize: '6' });
        const res = await fetch(`/api/admin/profiles?${params}`, { signal: controller.signal });
        const data = (await res.json().catch(() => ({}))) as { profiles?: PersonResult[] };
        setPeople(Array.isArray(data.profiles) ? data.profiles : []);
      } catch {
        // aborted or offline: keep previous results
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q, query]);

  const items = useMemo<Item[]>(() => {
    const actions: Item[] = [
      { kind: 'action', id: 'new-athlete', label: t('Add Athlete'), icon: UserPlus, href: '/dashboard/athletes?new=1', command: 'new-athlete' },
      { kind: 'action', id: 'new-class', label: t('Schedule a class'), icon: CalendarPlus, href: '/dashboard/schedule?new=1', command: 'new-class' },
    ];
    const pageItems: Item[] = pages.map((p) => ({
      kind: 'page',
      id: p.href,
      label: p.name,
      hint: p.group,
      icon: p.icon,
      href: p.href,
    }));
    const match = (label: string, hint?: string) =>
      !q || normalize(label).includes(q) || (hint ? normalize(hint).includes(q) : false);
    const personItems: Item[] =
      q.length >= 2
        ? people.map((p) => ({
            kind: 'person',
            id: p.id,
            label: p.full_name || p.email || t('Unnamed'),
            hint: [p.phone, p.email].filter(Boolean).join(' · ') || undefined,
            href: `/dashboard/athletes/${p.id}`,
          }))
        : [];
    return [
      ...personItems,
      ...actions.filter((a) => match(a.label)),
      ...pageItems.filter((p) => match(p.label, 'hint' in p ? p.hint : undefined)),
    ];
  }, [pages, people, q, t]);

  const safeActive = Math.min(active, Math.max(0, items.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${safeActive}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [safeActive]);

  const run = (item: Item) => {
    onClose();
    router.push(item.href);
    if (item.kind === 'action') {
      // Pages that are already open listen for this; fresh pages read ?new=1.
      window.dispatchEvent(new CustomEvent(PALETTE_EVENT, { detail: item.command }));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (items.length ? (Math.min(i, items.length - 1) + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (items.length ? (Math.min(i, items.length - 1) - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[safeActive];
      if (item) run(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const groupLabel = (item: Item) =>
    item.kind === 'person' ? t('People') : item.kind === 'action' ? t('Actions') : t('Pages');

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-pits-background/60 backdrop-blur-sm p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Search')}
        className="w-full max-w-xl rounded-2xl border border-pits-edge bg-pits-surface-elevated shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-pits-edge">
          {searching ? (
            <Loader2 size={18} className="text-pits-dim animate-spin shrink-0" />
          ) : (
            <Search size={18} className="text-pits-dim shrink-0" />
          )}
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t('Search people, pages or actions…')}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={items[safeActive] ? `cmd-${safeActive}` : undefined}
            className="flex-1 h-14 bg-transparent text-base text-pits-text placeholder:text-pits-dim outline-none"
          />
          <kbd className="hidden sm:inline text-[11px] font-semibold text-pits-dim border border-pits-edge rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        <ul id="command-palette-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-pits-dim">
              {searching ? t('Loading...') : t('No results for "{{query}}"', { query: query.trim() })}
            </li>
          ) : (
            items.map((item, index) => {
              const showHeader = index === 0 || items[index - 1].kind !== item.kind;
              const Icon = item.kind === 'person' ? User : item.icon;
              const selected = index === safeActive;
              return (
                <li key={`${item.kind}-${item.id}`} role="presentation">
                  {showHeader ? (
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-pits-dim">
                      {groupLabel(item)}
                    </p>
                  ) : null}
                  <div
                    id={`cmd-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => setActive(index)}
                    onClick={() => run(item)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer ${
                      selected ? 'bg-pits-primary-soft text-pits-text' : 'text-pits-text'
                    }`}
                  >
                    <Icon size={16} className={selected ? 'text-pits-primary' : 'text-pits-dim'} />
                    <span className="text-sm font-medium truncate">{item.label}</span>
                    {'hint' in item && item.hint ? (
                      <span className="text-xs text-pits-dim truncate">{item.hint}</span>
                    ) : null}
                    {selected ? <CornerDownLeft size={14} className="ml-auto text-pits-dim shrink-0" /> : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-pits-edge text-[11px] text-pits-dim">
          <span>↑↓ {t('to move')}</span>
          <span>↵ {t('to open')}</span>
          <span>⌘K / Ctrl K {t('anywhere')}</span>
        </div>
      </div>
    </div>
  );
}

/** Lets a page open its "new" form from the palette, whether it was already open or just loaded. */
export function usePaletteCommand(command: PaletteCommand, onCommand: () => void) {
  const handler = useRef(onCommand);
  useEffect(() => {
    handler.current = onCommand;
  });
  useEffect(() => {
    const listener = (e: Event) => {
      if ((e as CustomEvent).detail === command) handler.current();
    };
    window.addEventListener(PALETTE_EVENT, listener);
    return () => window.removeEventListener(PALETTE_EVENT, listener);
  }, [command]);
}
