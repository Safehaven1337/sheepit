"use client"

import { SplitFaq } from "@/components/ui/split-faq"

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <SplitFaq
      items={items.map((it, i) => ({
        id: `faq-${i}`,
        question: it.q,
        answer: it.a,
        icon: (["shield", "zap", "sparkles", "sync", "users", "billing"] as const)[i % 6],
      }))}
      defaultOpenIndex={0}
      className="w-full"
    />
  )
}
