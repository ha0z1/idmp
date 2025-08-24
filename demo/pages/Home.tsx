import { Link as LinkIcon, Rocket, Turtle, Zap } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { FaGithub } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import Ribbon from '../components/Ribbon'
import Item from '../Item'
import ItemIdmp from '../ItemIdmp'

const list = [
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
]

export default function IdmpDemoPage() {
  type Mode = 'idmp' | 'normal' | ''
  const [mode, _setMode] = useState<Mode>('')
  const setMode = (m: Mode) => {
    _setMode('')
    setTimeout(() => _setMode(m))
  }
  const navigate = useNavigate()
  const N = list.length

  const ModeBadge = useMemo(() => {
    if (!mode) return null
    const isIdmp = mode === 'idmp'
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
          isIdmp
            ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
            : 'bg-red-500/10 text-red-400 ring-red-500/30'
        }`}
      >
        {isIdmp ? (
          <Zap className="h-3.5 w-3.5" />
        ) : (
          <Turtle className="h-3.5 w-3.5" />
        )}
        {isIdmp ? 'IDMP (deduped & cached)' : 'Normal (no dedupe)'}
      </span>
    )
  }, [mode])

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Ambient gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(56,189,248,0.20),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 bg-[conic-gradient(from_210deg_at_40%_10%,rgba(168,85,247,0.15),transparent_40%)]" />
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <header className="mx-auto max-w-6xl px-6 pt-16 pb-4 sm:pt-20">
        <div className="flex items-center justify-between gap-3">
          <h1 className="bg-gradient-to-r from-cyan-300 via-white to-red-300 bg-clip-text text-3xl font-semibold tracking-tight text-balance text-transparent sm:text-4xl">
            IDMP Parallel Requests Demo
          </h1>

          <div>
            <a
              className="group mr-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              href="https://codesandbox.io/p/sandbox/sleepy-dust-phn8lp"
              target="_blank"
            >
              <Rocket className="h-4 w-4 opacity-80 transition group-hover:opacity-100" />
              Quick Start
            </a>
            <a
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              href="https://github.com/ha0z1/idmp"
              target="_blank"
            >
              <FaGithub className="h-4 w-4 opacity-80 transition group-hover:opacity-100" />
              Source
            </a>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm/6 text-slate-300">
          This demo shows the difference between firing {N} concurrent requests
          with and without using{' '}
          <span className="font-medium text-cyan-300">idmp</span>. With{' '}
          <span className="font-medium text-cyan-300">idmp</span> enabled, only
          3 actual requests are sent (you can verify it in the network console).
          <br />
          You don’t need to refactor your previous coding style — you only need
          to change a single line of code.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <a
            className="inline-flex items-center gap-1 hover:text-slate-200"
            href="https://github.com/ha0z1/idmp/blob/main/demo/ItemIdmp.tsx#L10"
            target="_blank"
          >
            <LinkIcon className="h-3.5 w-3.5" /> ItemIdmp.tsx
          </a>
          <span className="opacity-40">•</span>
          <a
            className="inline-flex items-center gap-1 hover:text-slate-200"
            href="https://github.com/ha0z1/idmp/blob/main/demo/Item.tsx#L10"
            target="_blank"
          >
            <LinkIcon className="h-3.5 w-3.5" /> Item.tsx
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        {/* Control Panel */}
        <div className="sticky top-0 z-10 -mx-6 mb-6 border-y border-white/5 bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60">
          <div className="mx-auto max-w-6xl px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode('idmp')}
                  className="group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 ring-emerald-500/30 transition hover:border-emerald-400/40 hover:bg-emerald-500/15 focus:ring-2 focus:outline-none"
                >
                  <Zap className="h-4 w-4" /> Make {N} parallel requests
                </button>
                <button
                  onClick={() => setMode('normal')}
                  className="group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 ring-red-500/30 transition hover:border-red-400/40 hover:bg-red-500/15 focus:ring-2 focus:outline-none"
                >
                  <Turtle className="h-4 w-4" /> Make {N} parallel requests
                  (without IDMP)
                </button>
              </div>
              <div className="flex items-center gap-2">
                {ModeBadge}
                <button
                  onClick={() => navigate('/storage')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
                >
                  localStorage / sessionStorage
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        {mode ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((id, i) => (
              <li key={`${id}-${i}`} className="group relative">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur transition duration-300 hover:border-white/20 hover:bg-white/[0.06]">
                  {/* Accent glow */}
                  <div
                    className="pointer-events-none absolute -inset-px -z-10 opacity-0 blur-2xl transition duration-500 group-hover:opacity-30"
                    style={{
                      background:
                        'radial-gradient(60% 50% at 30% 0%, rgba(34,197,94,0.35), rgba(168,85,247,0.2) 35%, rgba(0,0,0,0) 70%)',
                    }}
                  />

                  <div className="mb-3 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/80 to-red-500/80 text-[10px] font-semibold text-white shadow-inner">
                        {id}
                      </span>
                      <span className="opacity-80">request id</span>
                    </div>
                    <span className="text-[10px] tracking-wide text-slate-400 uppercase">
                      #{i + 1}
                    </span>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    {mode === 'idmp' ? <ItemIdmp id={id} /> : <Item id={id} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </main>

      <footer className="mx-auto max-w-6xl px-6 pt-8 pb-12 text-xs text-slate-500"></footer>
      <Ribbon />
    </div>
  )
}
