import type { Backend } from './api';
import { MockBackend } from './mock';
import { SupabaseBackend } from './supabase';
import { SoloBackend } from './solo';

/**
 * v2.1.0: the game is single-player by default (everything runs on the device).
 * The old multiplayer client is kept but hidden: open the page once with `?mp` to switch to it, `?solo` to come back.
 * Dev/test builds with VITE_BACKEND=mock keep the shared-localStorage mock unless `?solo` is given.
 */
export function multiplayerOn(): boolean {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('solo')) localStorage.removeItem('imp-mp'); else if (q.has('mp')) localStorage.setItem('imp-mp', '1');
    return localStorage.getItem('imp-mp') === '1';
  } catch { return false; }
}
export function makeBackend(): Backend {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const forceSolo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('solo');
  if (import.meta.env.VITE_BACKEND === 'mock' && !forceSolo) return new MockBackend();
  if (multiplayerOn() && url && key) return new SupabaseBackend(url, key);
  return new SoloBackend();
}
