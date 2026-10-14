import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll } from 'vitest'

// Mock environment variables for tests
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
vi.stubEnv('NVIDIA_API_KEY', 'test-nvidia-key')
vi.stubEnv('NVIDIA_MODEL', 'meta/llama-3.2-11b-vision-instruct')
vi.stubEnv('MAKE_WEBHOOK_URL', 'https://hook.make.com/test')
vi.stubEnv('MAKE_WEBHOOK_SECRET', 'test-secret')
vi.stubEnv('WEBHOOK_CRON_SECRET', 'test-cron-secret')
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    ...global.crypto,
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    subtle: global.crypto.subtle,
  },
  writable: true,
})

// Mock fetch for tests
global.fetch = vi.fn()

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
})

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeAll(() => {
  console.error = vi.fn()
  console.warn = vi.fn()
})

afterAll(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})