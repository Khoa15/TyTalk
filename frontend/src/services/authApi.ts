import { apiRequest } from './apiClient';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface Me {
  id: number;
  email: string;
  display_name: string;
  traits: Record<string, unknown>;
}

export const authApi = {
  signup: (email: string, password: string, displayName: string) =>
    apiRequest<TokenPair>('/auth/signup', {
      method: 'POST',
      body: { email, password, display_name: displayName },
    }),
  signin: (email: string, password: string) =>
    apiRequest<TokenPair>('/auth/signin', { method: 'POST', body: { email, password } }),
  tester: () => apiRequest<TokenPair>('/auth/tester', { method: 'POST' }),
  refresh: (refreshToken: string) =>
    apiRequest<TokenPair>('/auth/refresh', { method: 'POST', body: { refresh_token: refreshToken } }),
  signout: (refreshToken: string) =>
    apiRequest<void>('/auth/signout', { method: 'POST', body: { refresh_token: refreshToken } }),
  me: (token: string) => apiRequest<Me>('/me', { token }),
  resetPersona: (token: string) => apiRequest<void>('/me/persona', { method: 'DELETE', token }),
};
