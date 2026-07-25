"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Sync is optional. With no keys configured the app runs exactly as before,
// fully local, so a missing env var can never block a workout.
export const syncEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** The one host a magic link is allowed to deliver a session to. */
const SITE_URL = "https://gym-tracker-sigma-orpin.vercel.app";

/**
 * Where a sign-in link should land. Deliberately not window.location.origin:
 * that lets whatever page requested the link choose where the token is
 * delivered, so a lookalike host could ask for a link to a real address and
 * harvest the session when the mail is opened. Localhost stays allowed so dev
 * sign-in still works; every other origin is pinned to production.
 */
export function authRedirectTo(): string {
  if (typeof window === "undefined") return SITE_URL;
  const { origin, hostname } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1" ? origin : SITE_URL;
}

export function supabase(): SupabaseClient | null {
  if (!syncEnabled) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
