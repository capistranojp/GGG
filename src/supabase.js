/**
 * src/supabase.js — Supabase client + all DB helpers.
 */
import { createClient } from "@supabase/supabase-js";

const URL   = process.env.REACT_APP_SUPABASE_URL;
const KEY   = process.env.REACT_APP_SUPABASE_ANON_KEY;
const READY = !!(URL && KEY);

export const supabase = READY ? createClient(URL, KEY) : null;

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function isUsernameAvailable(username) {
  if (!supabase) return true;
  const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  return !data;
}

export async function createProfile(userId, username) {
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const { error } = await supabase.from("profiles").insert({ id: userId, username });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getProfile(userId) {
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
}

/** Login: look up profile by username, return { id, username } or null */
export async function getProfileByUsername(username) {
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("id, username").eq("username", username).maybeSingle();
  return data;
}

// ── Scores ────────────────────────────────────────────────────────────────────

export async function saveScore(entry) {
  if (!supabase) return { ok: false };
  const { error } = await supabase.from("scores").insert({
    user_id:       entry.userId,
    username:      entry.username,
    mode:          entry.mode,
    score:         entry.score,
    difficulty:    entry.difficulty  ?? null,
    category:      entry.category   ?? null,
    games_correct: entry.gamesCorrect ?? 0,
    time_limit:    entry.timeLimit   ?? 0,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getLeaderboard({ mode, difficulty, timeLimit, date, limit = 10 }) {
  if (!supabase) return [];
  let q = supabase
    .from("scores")
    .select("username, score, difficulty, games_correct, time_limit, play_date, created_at")
    .eq("mode", mode)
    .order("score", { ascending: false })
    .limit(limit);
  if (difficulty) q = q.eq("difficulty", difficulty);
  if (timeLimit)  q = q.eq("time_limit", timeLimit);
  if (date)       q = q.eq("play_date", date);
  const { data } = await q;
  return data ?? [];
}

export async function getPersonalBest(userId, mode, extra = {}) {
  if (!supabase) return null;
  let q = supabase.from("scores").select("score, games_correct, difficulty, created_at")
    .eq("user_id", userId).eq("mode", mode)
    .order("score", { ascending: false }).limit(1);
  if (extra.timeLimit)  q = q.eq("time_limit", extra.timeLimit);
  if (extra.difficulty) q = q.eq("difficulty", extra.difficulty);
  const { data } = await q;
  return data?.[0] ?? null;
}

// ── Gamedle Streaks ───────────────────────────────────────────────────────────

export async function getStreak(userId) {
  if (!supabase) return { streak: 0, best_streak: 0, last_won_date: null };
  const { data } = await supabase.from("gamedle_streaks").select("*").eq("user_id", userId).maybeSingle();
  return data ?? { streak: 0, best_streak: 0, last_won_date: null };
}

export async function updateStreak(userId, username, won) {
  if (!supabase) return { streak: 0, best_streak: 0 };
  const current = await getStreak(userId);
  const today   = new Date().toISOString().slice(0, 10);
  const yest    = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  let newStreak = 0;
  if (won) newStreak = current.last_won_date === yest ? current.streak + 1 : 1;
  const updated = {
    user_id:       userId,
    username,
    streak:        newStreak,
    best_streak:   Math.max(current.best_streak ?? 0, newStreak),
    last_won_date: won ? today : current.last_won_date,
    updated_at:    new Date().toISOString(),
  };
  await supabase.from("gamedle_streaks").upsert(updated);
  return updated;
}

export async function getStreakLeaderboard(limit = 10) {
  if (!supabase) return [];
  const { data } = await supabase.from("gamedle_streaks")
    .select("username, streak, best_streak")
    .order("best_streak", { ascending: false })
    .limit(limit);
  return data ?? [];
}
