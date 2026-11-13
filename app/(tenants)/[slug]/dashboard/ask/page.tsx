'use client';

import SpotterChat from '@/components/spotter/SpotterChat';

export default function AskAiPage() {
  return (
    <section className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-pits-border shadow-sm">
      <SpotterChat variant="page" />
    </section>
  );
}
