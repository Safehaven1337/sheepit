"use client"

import { useRouter } from "next/navigation"
import { ShimmerButton } from "@/components/ui/shimmer-button"

export function ShimmerLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const router = useRouter()
  return (
    <ShimmerButton
      background="#15151a"
      shimmerColor="#c6f432"
      className={className}
      onClick={() => router.push(href)}
      onMouseEnter={() => router.prefetch(href)}
    >
      {children}
    </ShimmerButton>
  )
}
