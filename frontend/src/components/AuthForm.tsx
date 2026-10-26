"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseClient();
      if (isSignup) {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (authError) throw authError;
        if (data.session) {
          router.replace("/profile?setup=1");
          return;
        }
        setNotice("Check your email to confirm your account, then log in to finish setting up your profile.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        router.replace("/dashboard");
      }
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "We could not complete that request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050b17] px-5 py-12 text-white">
      <div className="app-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-36 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
      <Link href="/" className="absolute left-6 top-6 flex items-center gap-3 sm:left-10 sm:top-8">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 font-black">S</span>
        <span className="font-bold tracking-tight">SpeakQuest</span>
      </Link>
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1425]/95 p-7 shadow-2xl shadow-black/40 sm:p-9">
        <div className="mb-7">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
            {isSignup ? "Your next chapter" : "Welcome back"}
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            {isSignup ? "Create your account" : "Log in to SpeakQuest"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {isSignup
              ? "Start building confidence in how you explain what you know."
              : "Pick up where your speaking practice left off."}
          </p>
        </div>

        {error && <p role="alert" className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
        {notice && <p role="status" className="mb-5 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm leading-6 text-cyan-100">{notice}</p>}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="block text-sm font-medium text-slate-200">
              Display name
              <input
                autoComplete="name"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#070f1d] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400"
                placeholder="How should we call you?"
              />
            </label>
          )}
          <label className="block text-sm font-medium text-slate-200">
            Email
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#070f1d] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Password
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#070f1d] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400"
              placeholder="At least 6 characters"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3.5 text-sm font-bold shadow-lg shadow-violet-950/40 transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? "Please wait…" : isSignup ? "Create account" : "Log in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          {isSignup ? "Already have an account?" : "New to SpeakQuest?"}{" "}
          <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-violet-300 hover:text-violet-200">
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
        <Link href="/" className="mt-5 block text-center text-xs text-slate-500 hover:text-slate-300">← Back to home</Link>
      </section>
    </main>
  );
}
