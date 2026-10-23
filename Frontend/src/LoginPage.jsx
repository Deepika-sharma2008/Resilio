import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, UtensilsCrossed } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to sign in.');
      }

      await onLogin();
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'Cannot connect to Resilio. Check your backend.'
          : err.message || 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-[#DCE5D8] bg-white p-7 shadow-[0_20px_60px_rgba(23,61,53,0.10)] sm:p-10">

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#173D35] text-[#F7F4EC]">
            <UtensilsCrossed size={26} />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-[#173D35]">
            Resilio<span className="text-[#78877C]">.</span>
          </h1>

          <p className="mt-2 text-sm text-[#78877C]">
            Welcome back. Sign in to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="admin-email" className="mb-2 block text-sm font-medium text-[#173D35]">
              Admin email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              placeholder="admin@resilio.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-[#D8DED3] bg-[#F7F4EC]/50 px-4 py-3.5 text-sm text-[#173D35] outline-none transition focus:border-[#78877C] focus:ring-4 focus:ring-[#DCE5D8]"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-2 block text-sm font-medium text-[#173D35]">
              Password
            </label>

            <div className="flex items-center rounded-xl border border-[#D8DED3] bg-[#F7F4EC]/50 pr-3 transition focus-within:border-[#78877C] focus-within:ring-4 focus-within:ring-[#DCE5D8]">
              <LockKeyhole className="ml-4 shrink-0 text-[#78877C]" size={17} />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full min-w-0 bg-transparent px-3 py-3.5 text-sm text-[#173D35] outline-none placeholder:text-[#78877C]/70"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="rounded-lg p-1.5 text-[#78877C] hover:text-[#173D35]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#173D35] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#244B40] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in to Resilio'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#78877C]">
          Secure administrator access
        </p>
      </div>
    </main>
  );
}