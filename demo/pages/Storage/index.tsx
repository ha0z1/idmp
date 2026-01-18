import idmp from 'idmp'
import storageWrap from 'idmp/browser-storage'
import { ArrowLeft, Database, Link as LinkIcon, RefreshCw } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUserData } from '../../api'

const lsIdmp = storageWrap(idmp, 'localStorage')

const getUserDataWithLsIdmp = (userId: string) =>
  lsIdmp(`getUserDataWithLsIdmp${userId}`, () => getUserData(userId), {
    maxAge: 5000,
  })

export default function StoragePage() {
  const [data, setData] = useState<any>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const ttl = 5000

  useEffect(() => {
    getUserDataWithLsIdmp('123').then((d) => {
      setData(d)
      setFetchedAt(Date.now())
    })
  }, [])

  // 计算剩余 TTL（仅用于展示）
  const ttlLeft = useMemo(() => {
    if (!fetchedAt) return 0
    const left = ttl - (Date.now() - fetchedAt)
    return Math.max(0, left)
  }, [fetchedAt, data])

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Ambient gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(56,189,248,0.20),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 bg-[conic-gradient(from_210deg_at_40%_10%,rgba(168,85,247,0.15),transparent_40%)]" />
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-3xl" />
      </div>

      <header className="mx-auto max-w-5xl px-6 pt-16 pb-2 sm:pt-20">
        <div className="flex items-center justify-between gap-3">
          <h1 className="bg-gradient-to-r from-cyan-300 via-white to-fuchsia-300 bg-clip-text text-3xl font-semibold tracking-tight text-balance text-transparent sm:text-4xl">
            IDMP Storage Demo
          </h1>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-sm/6 text-slate-300">
          Refresh the page and the data will be served from{' '}
          <span className="font-medium text-cyan-300">localStorage</span> within
          a<span className="text-fuchsia-300"> 5s TTL</span> — no network
          request in that window.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <a
            className="inline-flex items-center gap-1 hover:text-slate-200"
            href="https://github.com/ha0z1/idmp/blob/main/demo/pages/Storage/index.tsx#L7"
            target="_blank"
          >
            <LinkIcon className="h-3.5 w-3.5" /> Page source
          </a>
          <span className="opacity-40">•</span>
          <a
            className="inline-flex items-center gap-1 hover:text-slate-200"
            href="https://github.com/ha0z1/idmp/blob/main/plugins/browser-storage/README.md"
            target="_blank"
          >
            <LinkIcon className="h-3.5 w-3.5" /> Plugin docs
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-cyan-400/40 to-fuchsia-500/40 text-white">
                <Database className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  User data (cached)
                </h2>
                <p className="text-xs text-slate-400">
                  Key:{' '}
                  <code className="rounded bg-black/30 px-1 py-0.5">
                    getUserDataWithLsIdmp123
                  </code>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <RefreshCw className="h-3.5 w-3.5" /> TTL left:{' '}
                {Math.ceil(ttlLeft / 100) / 10}s
              </span>
            </div>
          </div>

          {/* data view */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            {!data ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-1/3 rounded bg-white/10" />
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="h-4 w-1/2 rounded bg-white/10" />
                <div className="h-32 w-full rounded bg-white/10" />
              </div>
            ) : (
              <pre className="max-h-80 overflow-auto rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-wrap text-slate-200">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-400">
            This page uses{' '}
            <a
              className="cursor-pointer text-cyan-300 hover:underline"
              href="https://github.com/ha0z1/idmp/blob/main/plugins/browser-storage/README.md"
            >
              storageWrap(idmp, 'localStorage')
            </a>{' '}
            so results are persisted to the browser's localStorage. Reload
            within 5 seconds to see a cache hit.
          </p>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 pt-8 pb-12 text-xs text-slate-500">
        <p>TailwindCSS + lucide-react · cohesive with the main demo page.</p>
      </footer>
    </div>
  )
}
