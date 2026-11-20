import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { authApi, type Me, type TokenPair } from '../services/authApi';

const REFRESH_MARGIN_MS = 30_000;

/** localStorage can be missing or throw (private mode, blocked site data). Fall back to memory. */
function safeStorage(): Storage {
  try {
    const probe = '__tytalk_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: (i: number) => [...mem.keys()][i] ?? null,
      get length() {
        return mem.size;
      },
    } as Storage;
  }
}

interface AuthState {
  /** Only the refresh token is persisted. The access token lives in memory and is re-issued on reload. */
  refreshToken: string | null;
  accessToken: string | null;
  accessExpiresAt: number;
  user: Me | null;

  signup: (email: string, password: string, displayName: string) => Promise<void>;
  signin: (email: string, password: string) => Promise<void>;
  signout: () => Promise<void>;
  /** Returns a usable access token, refreshing it when close to expiry. Null when signed out. */
  ensureToken: () => Promise<string | null>;
  loadMe: () => Promise<void>;
}

function applyPair(pair: TokenPair) {
  return {
    accessToken: pair.access_token,
    refreshToken: pair.refresh_token,
    accessExpiresAt: Date.now() + pair.expires_in * 1000,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      refreshToken: null,
      accessToken: null,
      accessExpiresAt: 0,
      user: null,

      signup: async (email, password, displayName) => {
        set(applyPair(await authApi.signup(email, password, displayName)));
        await get().loadMe();
      },

      signin: async (email, password) => {
        set(applyPair(await authApi.signin(email, password)));
        await get().loadMe();
      },

      signout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          await authApi.signout(refreshToken).catch(() => undefined);
        }
        set({ refreshToken: null, accessToken: null, accessExpiresAt: 0, user: null });
      },

      ensureToken: async () => {
        const { accessToken, accessExpiresAt, refreshToken } = get();
        if (accessToken && Date.now() < accessExpiresAt - REFRESH_MARGIN_MS) return accessToken;
        if (!refreshToken) return null;
        try {
          const pair = await authApi.refresh(refreshToken);
          set(applyPair(pair));
          return pair.access_token;
        } catch {
          set({ refreshToken: null, accessToken: null, accessExpiresAt: 0, user: null });
          return null;
        }
      },

      loadMe: async () => {
        const token = await get().ensureToken();
        if (!token) return;
        set({ user: await authApi.me(token) });
      },
    }),
    {
      name: 'tytalk-auth',
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({ refreshToken: state.refreshToken }),
    },
  ),
);
