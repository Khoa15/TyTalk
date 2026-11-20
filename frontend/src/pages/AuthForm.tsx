import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { OrbSlot } from '../components/OrbSlot';
import type { Route } from '../lib/transitionGraph';

import { ApiError } from '../services/apiClient';

export interface AuthFormProps {
  route: Route;
  title: string;
  submitLabel: string;
  showName: boolean;
  onSubmit: (email: string, password: string, name: string) => Promise<void>;
  onDone: () => void;
  footer: ReactNode;
  onTester: () => Promise<void>;
}

export function AuthForm({ route, title, submitLabel, showName, onSubmit, onDone, footer, onTester }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit(email, password, name);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(`Too many attempts, try again in ${err.retryAfter ?? 60} seconds`);
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not reach the server');
      }
    } finally {
      setBusy(false);
    }
  };

  const runTester = async () => {
    setError(null);
    setBusy(true);
    try {
      await onTester();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'Too many requests, try again shortly' : 'Tester login is unavailable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit} aria-label={title}>
        <Link to="/" className="back-btn" aria-label="Back to home" title="Back to home">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <OrbSlot route={route} size={240} className="auth-orb-slot" />
        <h1>{title}</h1>
        {showName && (
          <label>
            Display name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={showName ? 8 : 1}
            required
          />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={busy}>{submitLabel}</button>
        <button type="button" className="tester-btn" disabled={busy} onClick={() => void runTester()}>
          Login as a Tester
        </button>
        <p className="footer">{footer}</p>
      </form>
    </main>
  );
}
