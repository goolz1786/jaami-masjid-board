'use client';

import { useState, type SubmitEvent } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) { setError(body.error ?? 'Unable to sign in.'); setBusy(false); return; }
    window.location.href = '/admin';
  }
  return <main className="min-h-screen bg-[#0c1118] p-6 text-[#111] grid place-items-center">
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-[#b69747]/40 bg-[#f8f5ed] p-8 shadow-2xl">
      <img src="/assets/jaami-masjid-logo.png" alt="Jaami' Masjid Beyers Park" className="mb-7 h-20 w-full object-contain" />
      <div className="mb-7 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-[#0c1118] text-[#caa956]"><LockKeyhole className="size-5" /></span><h1 className="font-heading text-2xl font-bold">Management sign in</h1></div>
      <div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" name="username" autoComplete="username" required /></div>
      <div className="mt-4 space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button type="submit" className="mt-6 w-full bg-[#b69747] text-[#0c1118] hover:bg-[#caa956]" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      <a href="/display" className="mt-5 block text-center text-sm text-muted-foreground underline underline-offset-4">Return to display</a>
    </form>
  </main>;
}
