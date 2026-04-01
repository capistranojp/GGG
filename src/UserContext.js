/**
 * src/UserContext.js
 * Manages the current player's identity (userId + username).
 * userId is a UUID stored in localStorage — no passwords, no email required.
 */
import { createContext, useContext, useState, useEffect } from "react";
import { createProfile, getProfile, isUsernameAvailable } from "./supabase";

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
  const [error,    setError]    = useState(null);

  // On first load: if we have a userId but no username, try fetching the profile
  useEffect(() => {
    if (userId && !username) {
      getProfile(userId).then(p => {
        if (p?.username) {
          setUsername(p.username);
          localStorage.setItem(NAME_KEY, p.username);
        }
      });
    }
  }, [userId, username]);

  /**
   * Called when the user submits a username in the AuthModal.
   * Creates a new profile in Supabase and saves locally.
   * Returns { ok, error }.
   */
  async function register(name) {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) return { ok: false, error: "Username must be at least 2 characters." };
    if (trimmed.length > 20)           return { ok: false, error: "Username must be 20 characters or less." };
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return { ok: false, error: "Letters, numbers and underscores only." };

    setLoading(true); setError(null);

    const available = await isUsernameAvailable(trimmed);
    if (!available) { setLoading(false); return { ok: false, error: "Username already taken." }; }

    const id = makeUUID();
    const result = await createProfile(id, trimmed);
    if (!result.ok) { setLoading(false); return { ok: false, error: result.error }; }

    localStorage.setItem(UID_KEY,  id);
    localStorage.setItem(NAME_KEY, trimmed);
    setUserId(id);
    setUsername(trimmed);
    setLoading(false);
    return { ok: true };
  }

  /** Clear the current user session (sign out). */
  function signOut() {
    localStorage.removeItem(UID_KEY);
    localStorage.removeItem(NAME_KEY);
    setUserId(null);
    setUsername(null);
  }

  return (
    <UserCtx.Provider value={{ userId, username, loading, error, register, signOut, isLoggedIn: !!(userId && username) }}>
      {children}
    </UserCtx.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserCtx);
  if (!ctx) throw new Error("useUser must be used inside <UserProvider>");
  return ctx;
}
