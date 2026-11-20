import { useState, type FormEvent, type ReactNode } from 'react';

import { ApiError } from '../services/apiClient';

export interface AuthFormProps {
  title: string;
  submitLabel: string;
  showName: boolean;
  onSubmit: (email: string, password: string, name: string) => Promise<void>;
  onDone: () => void;
  footer: ReactNode;
}

export function AuthForm({ title, submitLabel, showName, onSubmit, onDone, footer }: AuthFormProps) {
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
        setError(`Thử lại sau ${err.retryAfter ?? 60} giây`);
      } else {
        setError(err instanceof ApiError ? err.message : 'Không kết nối được máy chủ');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit} aria-label={title}>
        <h1>{title}</h1>
        {showName && (
          <label>
            Tên hiển thị
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Mật khẩu
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
        <p className="footer">{footer}</p>
      </form>
    </main>
  );
}
