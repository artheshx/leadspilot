/**
 * The ONE way the LeadPilot dashboard talks to any AI feature.
 *
 * Every "AI action" in the dashboard (generate a strategy, write ad
 * creative, draft a landing page, get a campaign recommendation, ask a
 * support question, ...) is just a natural-language message sent here.
 * The AI Manager (FastAPI backend) is the only orchestrator: it decides
 * internally which tool to run via its Tool Registry. This file must stay
 * the ONLY place in the frontend that calls the AI Manager backend —
 * components should never call a tool/service endpoint directly, and
 * should never import fetch() to the backend themselves.
 */
import { supabase } from './supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface ManagerChatResult {
  message: string
  awaiting_user: boolean
  trace: unknown[]
}

export class AiManagerError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'AiManagerError'
  }
}

/**
 * Send one message to the AI Manager on behalf of the signed-in user's own
 * business (business_id is always the user's own Supabase id — see
 * backend/app/auth.py; the backend rejects any other business_id).
 *
 * @param message   Natural-language instruction, e.g. "Generate a Meta ad
 *                  strategy for a ₹15,000/month budget targeting Pune."
 * @param debug     Include the internal tool-call trace (dev/debug only).
 */
export async function askAiManager(message: string, debug = false): Promise<ManagerChatResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new AiManagerError('You must be signed in to use the AI Manager.', 401)
  }

  const response = await fetch(`${API_BASE_URL}/manager/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      business_id: session.user.id,
      message,
      debug,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new AiManagerError(body.detail ?? `AI Manager request failed (${response.status})`, response.status)
  }

  return (await response.json()) as ManagerChatResult
}
