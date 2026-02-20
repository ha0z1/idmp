import React, { PropsWithChildren } from 'react'
import type { Components } from 'react-markdown'
import Markdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism'
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
        className="border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 font-mono text-xs"
        {...props}
      >
        {text}
      </code>
    )
  }

  return (
    <pre className="overflow-x-auto border border-neutral-200 bg-neutral-50 p-4">
      <code className="block font-mono text-xs leading-relaxed" {...props}>
        <SyntaxHighlighter
          language={match?.[1]}
          style={prism}
          customStyle={{
            background: 'transparent',
            margin: 0,
            padding: 0,
          }}
          PreTag="div"
          CodeTag="code"
        >
          {text}
        </SyntaxHighlighter>
      </code>
    </pre>
  )
}

const mdComponents: Components = {
  h1: ({ node, ...props }) => (
    <h1 className="mt-16 mb-8 text-4xl font-light tracking-tight" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="mt-12 mb-6 text-3xl font-light tracking-tight" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mt-8 mb-4 text-xl font-medium" {...props} />
  ),
  h4: ({ node, ...props }) => (
    <h4 className="mt-6 mb-3 text-lg font-medium" {...props} />
  ),

  p: ({ node, ...props }) => (
    <p className="my-4 leading-7 text-neutral-700" {...props} />
  ),

  a: ({ node, ...props }) => (
    <a
      className="underline hover:text-black"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),

  ul: ({ node, ...props }) => (
    <ul className="my-4 ml-6 list-disc space-y-2 text-neutral-700" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol
      className="my-4 ml-6 list-decimal space-y-2 text-neutral-700"
      {...props}
    />
  ),
  li: ({ node, children, ...props }) => (
    <li className="pl-1" {...props}>
      {children}
    </li>
  ),

  input: ({ node, ...props }) => (
    <input className="mr-2 align-middle" disabled {...props} type="checkbox" />
  ),

  blockquote: ({ node, ...props }) => (
    <blockquote
      className="my-6 border-l-2 border-black pl-4 text-neutral-700 italic"
      {...props}
    />
  ),

  code: ({ className, children, ...props }) => (
    <CodeBlock inline={!className} className={className} {...props}>
      {children}
    </CodeBlock>
  ),

  hr: () => <div className="my-8 h-px w-full bg-neutral-200" />,

  img: ({ node, ...props }) => (
    <img
      className="my-4 border border-neutral-200"
      {...props}
      alt={(props as any).alt ?? ''}
    />
  ),

  table: ({ node, ...props }) => (
    <div className="my-6 overflow-x-auto border border-neutral-200">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead className="bg-neutral-50" {...props} />,
  tbody: ({ node, ...props }) => (
    <tbody className="divide-y divide-neutral-200" {...props} />
  ),
  tr: ({ node, ...props }) => (
    <tr className="divide-x divide-neutral-200" {...props} />
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
