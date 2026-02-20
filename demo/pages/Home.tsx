import { Github, Languages } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import README from '../../README.md?raw'
import README_ZH from '../../README.zh-CN.md?raw'
import Markdown from '../components/Markdown'
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
  type Lang = 'en' | 'zh'
  const [mode, _setMode] = useState<Mode>('')
  const [lang, setLang] = useState<Lang>('zh')
  const setMode = (m: Mode) => {
    _setMode('')
    setTimeout(() => _setMode(m))
  }
  const navigate = useNavigate()
  const N = list.length

  const t = useMemo(() => {
    if (lang === 'zh') {
      return {
        title: 'IDMP',
        subtitle: '智能去重并发异步调用。一次请求，多次回调。',
        description: (n: number) =>
          `触发 ${n} 个相同 ID 的并发请求。使用 IDMP 时，只会发起 1 次网络调用，但所有 ${n} 个回调都会正确触发。`,
        runWithIdmp: '使用 IDMP 运行',
        runWithoutIdmp: '不使用 IDMP 运行',
        storageDemo: '存储演示 →',
        modeIdmp: 'IDMP（已去重和缓存）',
        modeNormal: '普通（无去重）',
        requestNum: '请求',
        loading: '加载中...',
        footer: 'IDMP · 轻量级 Promise 去重',
      }
    }
    return {
      title: 'IDMP',
      subtitle:
        'Intelligent deduplication of concurrent async calls. One request, multiple callbacks.',
      description: (n: number) =>
        `Trigger ${n} concurrent requests with the same ID. With IDMP, only 1 network call is made, but all ${n} callbacks fire correctly.`,
      runWithIdmp: 'Run with IDMP',
      runWithoutIdmp: 'Run without IDMP',
      storageDemo: 'Storage Demo →',
      modeIdmp: 'IDMP (deduped & cached)',
      modeNormal: 'Normal (no dedupe)',
      requestNum: 'Request',
      loading: 'Loading...',
      footer: 'IDMP · Lightweight promise deduplication',
    }
  }, [lang])

  const ModeBadge = useMemo(() => {
    if (!mode) return null
    const isIdmp = mode === 'idmp'
    return (
      <span
        className={`inline-flex items-center gap-2 border px-3 py-1 text-xs font-medium ${
          isIdmp
            ? 'border-black bg-black text-white'
            : 'border-black bg-white text-black'
        }`}
      >
        {isIdmp ? t.modeIdmp : t.modeNormal}
      </span>
    )
  }, [mode, t])

  return (
    <div className="relative min-h-screen w-full bg-white text-black">
      <header className="mx-auto max-w-4xl px-8 pt-24 pb-8">
        <div className="mb-16 flex items-start justify-between gap-8">
          <div className="flex-1">
            <h1 className="mb-4 text-5xl leading-tight font-light tracking-tight">
              {t.title}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-neutral-600">
              {t.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm transition-colors hover:border-black"
              title={lang === 'zh' ? 'Switch to English' : '切换到中文'}
            >
              <Languages className="h-4 w-4" /> {lang === 'zh' ? 'EN' : '中文'}
            </button>
            <a
              href="https://github.com/ha0z1/idmp"
              target="_blank"
              className="inline-flex items-center gap-2 border border-black px-4 py-2 text-sm transition-colors hover:bg-black hover:text-white"
            >
              <Github className="h-4 w-4" /> GitHub
            </a>
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-8">
          <p className="mb-6 text-sm text-neutral-600">{t.description(N)}</p>

          <div className="mb-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setMode('idmp')}
              disabled={mode === 'idmp'}
              className="border border-black bg-black px-6 py-2 text-sm text-white transition-colors hover:bg-neutral-800 disabled:cursor-default disabled:opacity-100"
            >
              {t.runWithIdmp}
            </button>
            <button
              onClick={() => setMode('normal')}
              disabled={mode === 'normal'}
              className="border border-black bg-white px-6 py-2 text-sm text-black transition-colors hover:bg-neutral-100 disabled:cursor-default disabled:bg-black disabled:text-white"
            >
              {t.runWithoutIdmp}
            </button>
            <button
              onClick={() => navigate('/storage')}
              className="border border-neutral-300 bg-white px-6 py-2 text-sm text-black transition-colors hover:border-black"
            >
              {t.storageDemo}
            </button>
          </div>

          {ModeBadge && <div className="mb-8">{ModeBadge}</div>}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-8 pb-24">
        {mode ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((id, i) => (
              <li key={i} className="border border-neutral-200 p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {t.requestNum} #{i + 1}
                  </span>
                  <span className="font-mono">ID: {id}</span>
                </div>
                <div className="border border-neutral-100 bg-neutral-50 p-3 font-mono text-xs">
                  {mode === 'idmp' ? <ItemIdmp id={id} /> : <Item id={id} />}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <article className="prose prose-neutral max-w-none">
            <Markdown>
              {(lang === 'zh' ? README_ZH : README).split('## Usage')?.[1] ||
                (lang === 'zh' ? README_ZH : README).split('## 使用')?.[1]}
            </Markdown>
          </article>
        )}
      </main>

      <footer className="mx-auto max-w-4xl border-t border-neutral-200 px-8 pt-8 pb-12">
        <p className="text-xs text-neutral-500">
          <a href="https://github.com/ha0z1/idmp" className="hover:text-black">
            IDMP
          </a>{' '}
          · {t.footer}
        </p>
      </footer>
    </div>
  )
}
