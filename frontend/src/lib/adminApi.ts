/**
 * Client for the Admin CRM REST endpoints (backend/app/routers/admin.py).
 *
 * Distinct from lib/aiManager.ts on purpose: aiManager.ts is the ONLY path
 * for natural-language AI actions (POST /manager/chat). The Admin CRM is a
 * different kind of surface — plain CRUD over admin-only config/data
 * (AI providers, prompts, routing, flags, audit log, Meta/WhatsApp config,
 * the admin-managed Knowledge Base, admin roles, plans, system health,
 * queue monitor) — so it gets its own small REST client here instead of
 * being forced through the chat endpoint.
 *
 * Every call attaches the signed-in user's Supabase access token; the
 * backend rejects anything from a non-admin profile with 403.
 */
import { supabase } from './supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class AdminApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'AdminApiError'
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new AdminApiError('You must be signed in as an admin to use the Admin CRM.', 401)
  }
  return { Authorization: `Bearer ${session.access_token}` }
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = await response.json()
      detail = body.detail ?? detail
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new AdminApiError(detail, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function adminGet<T>(path: string): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE_URL}/admin${path}`, { headers })
  return handle<T>(res)
}

export async function adminSend<T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown
): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE_URL}/admin${path}`, {
    method,
    headers: { ...headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handle<T>(res)
}

/** For multipart/form-data endpoints (Knowledge Base upload/replace). */
export async function adminUpload<T>(path: string, method: 'POST' | 'PUT', formData: FormData): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE_URL}/admin${path}`, { method, headers, body: formData })
  return handle<T>(res)
}
