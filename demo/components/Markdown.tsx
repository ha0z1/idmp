import clsx from 'clsx'
import React, { PropsWithChildren } from 'react'
import type { Components } from 'react-markdown'
import Markdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'

function CodeBlock({
  inline,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
  const text = String(children ?? '')

  const match = /language-(\w+)/.exec(className || '')

  if (inline) {
    return (
      <code
        className={clsx(
          'rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5',
          'font-mono text-[13px] leading-relaxed text-cyan-200 shadow-inner',
          'whitespace-pre-wrap break-words',
        )}
        {...props}
      >
        {text}
      </code>
    )
  }

  return (
    <pre
      className={clsx(
        'group relative overflow-x-auto rounded-xl border border-white/10 p-4',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur',
        'scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent',
      )}
      style={{
        backgroundColor: '#282c34',
      }}
    >
      <code
        className={clsx(
          'block font-mono text-[13px] leading-6 text-slate-200',
          className,
        )}
        {...props}
      >
        <SyntaxHighlighter
          language={match?.[1]}
          style={oneDark}
          customStyle={{
            background: 'transparent',
            margin: 0,
            padding: '1rem',
          }}
          PreTag="div"
          CodeTag="code"
          wrapLines
        >
          {text}
        </SyntaxHighlighter>
      </code>
      {/* 顶部微光 */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-px h-px opacity-60"
        style={{
          background:
            'linear-gradient(90deg, rgba(34,197,94,0.3), rgba(168,85,247,0.25), rgba(34,197,94,0.3))',
        }}
      />
    </pre>
  )
}

const mdComponents: Components = {
  h1: ({ node, ...props }) => (
    <h1
      className={clsx(
        'bg-gradient-to-r from-cyan-300 via-white to-red-300 bg-clip-text text-transparent',
        'mb-4 mt-8 text-3xl font-semibold tracking-tight sm:text-4xl',
      )}
      {...props}
    />
  ),
  h2: ({ node, ...props }) => (
    <h2
      className={clsx(
        'mb-3 mt-10 text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl',
        'relative',
      )}
      {...props}
    />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mb-2 mt-8 text-xl font-semibold text-slate-100" {...props} />
  ),
  h4: ({ node, ...props }) => (
    <h4 className="mb-2 mt-6 text-lg font-semibold text-slate-100" {...props} />
  ),

  // 段落/文本
  p: ({ node, ...props }) => (
    <p className="my-4 leading-7 text-slate-300" {...props} />
  ),

  // 链接：青色强调 + 悬浮下划线 + 轻微过渡
  a: ({ node, ...props }) => (
    <a
      className="text-cyan-300 underline decoration-white/20 underline-offset-4 transition hover:text-cyan-200"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),

  // 列表：紧凑、彩色标记
  ul: ({ node, ...props }) => (
    <ul
      className="my-4 ml-6 list-disc space-y-2 text-slate-300 marker:text-cyan-300/80"
      {...props}
    />
  ),
  ol: ({ node, ...props }) => (
    <ol
      className="my-4 ml-6 list-decimal space-y-2 text-slate-300 marker:text-cyan-300/80"
      {...props}
    />
  ),
  li: ({ node, children, ...props }) => (
    <li className="pl-1" {...props}>
      {children}
    </li>
  ),

  // 任务清单（GFM）
  input: ({ node, ...props }) => (
    <input
      className="mr-2 align-middle accent-cyan-400"
      disabled
      {...props}
      type="checkbox"
    />
  ),

  // 引用块：青紫渐变边 + 玻璃底
  blockquote: ({ node, ...props }) => (
    <blockquote
      className={clsx(
        'my-6 border-l-2 pl-4 italic text-slate-300',
        'rounded-r-xl border-white/10 bg-white/[0.04] py-3',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.04)]',
      )}
      {...props}
    />
  ),

  // 代码（行内/块）
  code: ({ className, children, ...props }) => (
    <CodeBlock inline={!className} className={className} {...props}>
      {children}
    </CodeBlock>
  ),

  // HR：细线 + 微光
  hr: () => (
    <div className="my-8 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  ),

  // 图片：圆角 + 细边 + 轻微阴影
  img: ({ node, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="my-4 rounded-xl border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
      {...props}
      alt={(props as any).alt ?? ''}
    />
  ),

  // 表格：自适应滚动 + 细分割线 + 暗底
  table: ({ node, ...props }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <table
        className="w-full border-collapse text-sm text-slate-200"
        {...props}
      />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="bg-white/5 text-slate-200" {...props} />
  ),
  tbody: ({ node, ...props }) => (
    <tbody className="divide-y divide-white/10" {...props} />
  ),
  tr: ({ node, ...props }) => (
    <tr className="divide-x divide-white/10" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th className="px-3 py-2 text-left font-medium" {...props} />
  ),
  td: ({ node, ...props }) => <td className="px-3 py-2" {...props} />,
}

export default (props: PropsWithChildren<any>) => {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {props.children}
    </Markdown>
  )
}
