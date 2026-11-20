import Link from "next/link"
import { SheepMark } from "@/components/brand/sheep-logo"

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4 text-center">
      <div className="grid justify-items-center gap-4">
        <SheepMark className="size-20" />
        <h1 className="text-3xl font-semibold">Dieses Schaf ist ausgebüxt.</h1>
        <p className="text-muted-foreground">Die Seite gibt es nicht (mehr).</p>
        <Link href="/" className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground">Zur Startseite</Link>
      </div>
    </main>
  )
}
