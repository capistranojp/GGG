/**
 * src/UserContext.js
 * Passwords are hashed with bcryptjs (cost 10) before storing in Supabase.
 * The plaintext password is NEVER stored anywhere — only the hash.
 * On login: fetch hash from DB, verify with bcrypt.compare() in-browser, then discard hash.
 */
import { createContext, useContext, useState, useEffect } from "react";
import bcrypt from "bcryptjs";
import { createProfile, getProfile, isUsernameAvailable, getProfileByUsername } from "./supabase";

const UID_KEY  = "ggg_user_id";
const NAME_KEY = "ggg_username";

function makeUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const UserCtx = createContext(null);

export function UserProvider({ children }) {
  const [userId,   setUserId]   = useState(() => localStorage.getItem(UID_KEY));
  const [username, setUsername] = useState(() => localStorage.getItem(NAME_KEY));
  const [loading,  setLoading]  = useState(false);

  // Restore username from Supabase if localStorage was cleared
  useEffect(() => {
    if (userId && !username) {
      getProfile(userId).then(p => {
        if (p?.username) { setUsername(p.username); localStorage.setItem(NAME_KEY, p.username); }
      });
    }
  }, [userId, username]);

  function setSession(id, name) {
    localStorage.setItem(UID_KEY, id);
    localStorage.setItem(NAME_KEY, name);
    setUserId(id);
    setUsername(name);
  }

  async function register(name, password) {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2)        return { ok: false, error: "Username must be at least 2 characters." };
    if (trimmed.length > 20)                   return { ok: false, error: "Username must be 20 characters or less." };
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed))     return { ok: false, error: "Letters, numbers and underscores only." };
    if (!password || password.length < 6)      return { ok: false, error: "Password must be at least 6 characters." };

    setLoading(true);
    const available = await isUsernameAvailable(trimmed);
    if (!available) { setLoading(false); return { ok: false, error: "Username already taken." }; }

    // Hash password with bcrypt (cost 10 — secure but fast enough in-browser)
    const hash   = await bcrypt.hash(password, 10);
    const id     = makeUUID();
    const result = await createProfile(id, trimmed, hash);
    if (!result.ok) { setLoading(false); return { ok: false, error: result.error }; }

    setSession(id, trimmed);
    setLoading(false);
    return { ok: true };
  }

  async function login(name, password) {
    const trimmed = name.trim();
    if (!trimmed)   return { ok: false, error: "Enter your username." };
    if (!password)  return { ok: false, error: "Enter your password." };

    setLoading(true);
    const profile = await getProfileByUsername(trimmed);
    if (!profile) { setLoading(false); return { ok: false, error: "Username not found. Did you mean to register?" }; }

    // Verify password against stored hash
    const match = await bcrypt.compare(password, profile.password_hash);
    if (!match) { setLoading(false); return { ok: false, error: "Incorrect password." }; }

    // Don't store the hash — only the safe session identifiers
    setSession(profile.id, profile.username);
    setLoading(false);
    return { ok: true };
  }

  function signOut() {
    localStorage.removeItem(UID_KEY);
    localStorage.removeItem(NAME_KEY);
    setUserId(null);
    setUsername(null);
  }

  return (
    <UserCtx.Provider value={{ userId, username, loading, register, login, signOut, isLoggedIn: !!(userId && username) }}>
      {children}
    </UserCtx.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserCtx);
  if (!ctx) throw new Error("useUser must be used inside <UserProvider>");
  return ctx;
}
