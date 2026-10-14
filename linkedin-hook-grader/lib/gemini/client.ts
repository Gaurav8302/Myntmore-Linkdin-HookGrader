/**
 * NVIDIA NIM client (OpenAI-compatible chat completions)
 * Server-side only — never expose NVIDIA_API_KEY to the browser
 */

export const NVIDIA_API_URL =
  process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions'

/** Live-tested 2026-10-14 against this account's NVIDIA key */
export const NVIDIA_MODEL =
  process.env.NVIDIA_MODEL || 'meta/llama-3.2-11b-vision-instruct'

export type Rewrite = {
  hook: string
  reason: string
}

export type NvidiaResponse = {
  rewrites: Rewrite[]
}

export function getNvidiaApiKey(): string {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY environment variable is required')
  }
  return apiKey
}

/**
 * Call NVIDIA chat completions and return assistant text
 */
export async function callNvidiaChat(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<string> {
  const apiKey = getNvidiaApiKey()
  const controller = new AbortController()
  const timeoutMs = options?.timeoutMs ?? 45000
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
      signal: controller.signal,
    })

    const json = (await response.json()) as {
      error?: { message?: string }
      choices?: Array<{ message?: { content?: string } }>
    }

    if (!response.ok) {
      throw new Error(json.error?.message || `NVIDIA HTTP ${response.status}`)
    }

    const text = json.choices?.[0]?.message?.content
    if (!text || !text.trim()) {
      throw new Error('Empty response from NVIDIA')
    }
    return text
  } finally {
    clearTimeout(timer)
  }
}
