import React, { createContext, ReactNode, useContext, useState } from 'react'

type Lang = 'en' | 'zh'

interface LangContextType {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LangContext = createContext<LangContextType | undefined>(undefined)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('zh')

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const context = useContext(LangContext)
  if (context === undefined) {
    throw new Error('useLang must be used within a LangProvider')
  }
  return context
}
