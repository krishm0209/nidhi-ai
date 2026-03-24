import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const rl = await rateLimit(`itr-explain:${user.id}`, 30, 60)
  if (!rl.success) return new Response('Too many requests', { status: 429 })

  const { topic, context } = await req.json() as { topic: string; context?: string }

  const prompt = `You are NidhiAI, explaining Indian income tax filing to a first-time filer (new joiner, salaried employee).
Explain "${topic}" in plain English — simple, friendly, no jargon. Max 4 sentences.
${context ? `User context: ${context}` : ''}

If relevant, mention:
- What the term means in simple words
- Why it matters when filing ITR
- One common mistake first-timers make
- A quick tip

Keep it under 100 words. No bullet points — just conversational sentences.`

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContentStream(prompt)

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) controller.enqueue(new TextEncoder().encode(text))
      }
      controller.close()
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
