'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Plus, Sparkles, Loader2, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface Session {
  id: string
  title: string
  created_at: string
}

const STARTERS = [
  'Am I over-diversified in mutual funds?',
  'What are my tax-saving opportunities this year?',
  'How should I rebalance my portfolio?',
  'Which holdings have the highest risk?',
  'Should I increase my SIP amount?',
  'Explain my LTCG exposure this year.',
]

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={clsx('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={clsx(
        'h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-zinc-200' : 'bg-gradient-to-br from-emerald-400 to-teal-500'
      )}>
        {isUser
          ? <span className="text-xs font-semibold text-zinc-600">U</span>
          : <Sparkles className="h-3.5 w-3.5 text-white" />
        }
      </div>

      {/* Bubble */}
      <div className={clsx(
        'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-emerald-600 text-white rounded-tr-sm'
          : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm shadow-sm'
      )}>
        {msg.streaming && !msg.content
          ? (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
            </div>
          )
          : (
            <span className="whitespace-pre-wrap">
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-zinc-400 animate-pulse align-middle" />
              )}
            </span>
          )}
      </div>
    </div>
  )
}

export function AdvisorClient({ initialSessions }: { initialSessions: Session[] }) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initialSessions[0]?.id ?? null
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load messages for active session
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      return
    }
    setLoadingHistory(true)
    fetch(`/api/ai/advisor/sessions/${activeSessionId}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false))
  }, [activeSessionId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startNewChat = useCallback(() => {
    setActiveSessionId(null)
    setMessages([])
    inputRef.current?.focus()
  }, [])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setInput('')
    setLoading(true)

    // Optimistically add user message
    const userMsg: Message = { role: 'user', content: trimmed }
    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true }
    setMessages((prev) => [...prev, userMsg, assistantMsg])

    try {
      const res = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId: activeSessionId,
        }),
      })

      // Pick up new session ID if it was just created
      const newSessionId = res.headers.get('X-Session-Id')
      if (newSessionId && !activeSessionId) {
        setActiveSessionId(newSessionId)
        const title = trimmed.slice(0, 60) + (trimmed.length > 60 ? '…' : '')
        setSessions((prev) => [{ id: newSessionId, title, created_at: new Date().toISOString() }, ...prev])
      }

      // Stream response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response body')

      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: accumulated, streaming: true }
          return copy
        })
      }

      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: accumulated, streaming: false }
        return copy
      })
    } catch {
      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          streaming: false,
        }
        return copy
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0 && !loadingHistory

  return (
    <div className="flex h-full max-w-6xl">
      {/* Sidebar — sessions */}
      <div className="hidden lg:flex flex-col w-56 shrink-0 border-r border-zinc-200 bg-white">
        <div className="p-3 border-b border-zinc-100">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 && (
            <p className="px-3 py-4 text-xs text-zinc-400 text-center">No conversations yet</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={clsx(
                'w-full text-left px-3 py-2 rounded-lg text-xs transition-colors',
                activeSessionId === s.id
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-zinc-600 hover:bg-zinc-50'
              )}
            >
              <span className="line-clamp-2">{s.title ?? 'New conversation'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-50">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {loadingHistory ? (
            <div className="flex justify-center pt-12">
              <Loader2 className="h-5 w-5 text-zinc-300 animate-spin" />
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 mb-1">AI Portfolio Advisor</h2>
              <p className="text-sm text-zinc-500 mb-6">
                Ask anything about your portfolio — allocation, taxes, rebalancing, risk.
              </p>

              {/* Starter suggestions */}
              <div className="w-full space-y-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left flex items-center gap-2 px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-zinc-200 bg-white px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your portfolio…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-zinc-400 max-h-40 overflow-y-auto"
              style={{ lineHeight: '1.5' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </button>
          </div>
          <p className="max-w-2xl mx-auto mt-2 text-[10px] text-zinc-400 text-center">
            NidhiAI is not a SEBI-registered advisor. Responses are informational only.
          </p>
        </div>
      </div>
    </div>
  )
}
