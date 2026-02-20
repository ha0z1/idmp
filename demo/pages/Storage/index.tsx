import idmp from 'idmp'
import storageWrap from 'idmp/browser-storage'
import { ArrowLeft, Database, Languages } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUserData } from '../../api'

const lsIdmp = storageWrap(idmp, 'localStorage')

const getUserDataWithLsIdmp = (userId: string) =>
  lsIdmp(`getUserDataWithLsIdmp${userId}`, () => getUserData(userId), {
    maxAge: 5000,
  })

export default function StoragePage() {
  type Lang = 'en' | 'zh'
  const [data, setData] = useState<any>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [lang, setLang] = useState<Lang>('zh')
  const ttl = 5000

  const t = useMemo(() => {
    if (lang === 'zh') {
      return {
        title: '存储演示',
        subtitle:
          '刷新页面，数据将在 5 秒 TTL 内从 localStorage 提供 — 在此期间无需网络请求。',
        back: '返回',
        userDataCached: '用户数据（已缓存）',
        key: '键',
        ttlRemaining: 'TTL 剩余',
        loading: '加载中...',
        description: '此页面使用',
        descriptionLink: "storageWrap(idmp, 'localStorage')",
        descriptionEnd:
          '因此结果会持久化到浏览器的 localStorage。在 5 秒内重新加载以查看缓存命中。',
        footer: 'IDMP · 轻量级 Promise 去重',
      }
    }
    return {
      title: 'Storage Demo',
      subtitle:
        'Refresh the page and data will be served from localStorage within a 5s TTL — no network request in that window.',
      back: 'Back',
      userDataCached: 'User data (cached)',
      key: 'Key',
      ttlRemaining: 'TTL remaining',
      loading: 'Loading...',
      description: 'This page uses',
      descriptionLink: "storageWrap(idmp, 'localStorage')",
      descriptionEnd:
        "so results are persisted to the browser's localStorage. Reload within 5 seconds to see a cache hit.",
      footer: 'IDMP · Lightweight promise deduplication',
    }
  }, [lang])

  useEffect(() => {
    getUserDataWithLsIdmp('123').then((d) => {
      setData(d)
      setFetchedAt(Date.now())
    })
  }, [])

  const ttlLeft = useMemo(() => {
    if (!fetchedAt) return 0
    const left = ttl - (Date.now() - fetchedAt)
    return Math.max(0, left)
  }, [fetchedAt, data])

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
            <Link
              to="/"
              className="inline-flex items-center gap-2 border border-black px-4 py-2 text-sm transition-colors hover:bg-black hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </Link>
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-8">
          <div className="mb-6 flex items-center gap-3">
            <Database className="h-5 w-5" />
            <div>
              <h2 className="text-sm font-medium">{t.userDataCached}</h2>
              <p className="mt-1 text-xs text-neutral-500">
                {t.key}:{' '}
                <code className="bg-neutral-100 px-1 py-0.5 font-mono">
                  getUserDataWithLsIdmp123
                </code>
              </p>
            </div>
          </div>

          <div className="mb-4">
            <span className="inline-flex items-center gap-2 border border-black bg-white px-3 py-1 text-xs font-medium">
              {t.ttlRemaining}: {Math.ceil(ttlLeft / 100) / 10}s
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-8 pb-24">
        <div className="border border-neutral-200 p-6">
          {!data ? (
            <div className="space-y-3">
              <div className="h-3 w-1/3 animate-pulse bg-neutral-200" />
              <div className="h-3 w-2/3 animate-pulse bg-neutral-200" />
              <div className="h-3 w-1/2 animate-pulse bg-neutral-200" />
              <div className="h-32 w-full animate-pulse bg-neutral-200" />
            </div>
          ) : (
            <pre className="overflow-auto font-mono text-xs leading-relaxed">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>

        <p className="mt-6 text-sm text-neutral-600">
          {t.description}{' '}
          <a
            className="underline hover:text-black"
            href="https://github.com/ha0z1/idmp/blob/main/plugins/browser-storage/README.md"
            target="_blank"
          >
            {t.descriptionLink}
          </a>{' '}
          {t.descriptionEnd}
        </p>
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
