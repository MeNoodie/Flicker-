"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { ApiError, getProfile, getProgress } from "@/lib/api";
import type { Profile, UserProgress } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        const token = await getAccessToken();
        if (!token) {
          router.replace("/login");
          return;
        }
        const savedProfile = await getProfile(token);
        if (!active) return;
        setProfile(savedProfile);
        try {
          setProgress(await getProgress(token));
        } catch (progressError) {
          console.warn("Could not load learning progress:", progressError);
        }
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.status === 404) {
          router.replace("/profile?setup=1");
        } else if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load your dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDashboard();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#050b17] text-slate-300"><p className="animate-pulse text-sm">Getting your learning space ready…</p></main>;
  }
  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050b17] px-5 text-white">
        <section className="max-w-md rounded-2xl border border-rose-300/20 bg-[#0b1425] p-7">
          <h1 className="text-lg font-bold">Dashboard unavailable</h1>
          <p role="alert" className="mt-2 text-sm leading-6 text-rose-200">{error}</p>
          <button onClick={() => router.refresh()} className="mt-5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold">Try again</button>
        </section>
      </main>
    );
  }

  const games = [
    {
      mode: "spinner",
      icon: "🎡",
      title: "Topic Spinner",
      description: "Spin for a personalized prompt from your topic library.",
      action: "Play spinner",
      colors: "from-violet-500/20 to-indigo-500/5",
    },
    {
      mode: "mystery_cards",
      icon: "🃏",
      title: "Mystery Cards",
      description: "Reveal a surprise challenge and think on your feet.",
      action: "Pick a card",
      colors: "from-cyan-500/15 to-blue-500/5",
    },
  ];

  return (
    <main className="min-h-screen bg-[#050b17] text-white">
      <header className="border-b border-white/10 bg-[#081120]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 font-black">S</span>
            <span className="font-bold tracking-tight">SpeakQuest</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <span className="rounded-lg bg-violet-400/10 px-3 py-2 font-semibold text-violet-200">Home</span>
            <Link href="/profile" className="rounded-lg px-3 py-2 text-slate-400 transition hover:bg-white/5 hover:text-white">Profile</Link>
            <button
              onClick={async () => {
                const { error: signOutError } = await (await import("@/lib/supabase")).getSupabaseClient().auth.signOut();
                if (signOutError) setError(signOutError.message);
                else router.replace("/login");
              }}
              className="ml-1 rounded-lg border border-white/10 px-3 py-2 text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-violet-300">YOUR PRACTICE SPACE</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Good to see you, {profile?.display_name || "speaker"}.</h1>
            <p className="mt-2 text-sm text-slate-400">Choose a game and turn what you know into a clear explanation.</p>
          </div>
          <Link href="/profile" className="w-fit rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-violet-300/30 hover:bg-white/[0.07]">
            Edit profile <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["🏆", (progress?.total_xp ?? 0).toLocaleString(), "Total XP", "text-amber-200"],
            ["✅", (progress?.completed_sessions ?? 0).toString(), "Completed sessions", "text-emerald-200"],
            ["📊", profile?.experience_level ?? "Beginner", "Practice level", "text-cyan-200"],
            ["🔥", `${progress?.current_streak ?? 0} days`, "Current streak", "text-orange-200"],
          ].map(([icon, value, label, color]) => (
            <article key={label} className="rounded-2xl border border-white/10 bg-[#0b1425] p-5">
              <div className="flex items-center justify-between">
                <span className={`text-xl ${color}`}>{icon}</span>
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.6)]" />
              </div>
              <p className="mt-4 text-2xl font-bold capitalize">{value}</p>
              <p className="mt-1 text-xs text-slate-400">{label}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Pick your challenge</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">How would you like to practice?</h2>
          </div>
          <p className="text-sm text-slate-400">{profile?.topics.length ?? 0} topics in your library</p>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {games.map((game) => (
            <article key={game.mode} className={`group overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${game.colors} p-6 transition hover:-translate-y-1 hover:border-violet-300/30 sm:p-8`}>
              <div className="flex items-start justify-between">
                <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-[#07101e]/70 text-3xl">{game.icon}</span>
                <span className="rounded-full border border-white/10 bg-[#07101e]/50 px-3 py-1 text-[11px] font-semibold text-slate-300">AI-powered</span>
              </div>
              <h3 className="mt-7 text-xl font-bold">{game.title}</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">{game.description}</p>
              <Link href={`/game?mode=${game.mode}`} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold shadow-lg shadow-violet-950/40 transition group-hover:bg-violet-500">
                {game.action} <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl border border-white/10 bg-[#0b1425] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Your learning library</p>
                <h2 className="mt-2 text-lg font-bold">Topics you&apos;re working on</h2>
              </div>
              <Link href="/profile" className="text-xs font-semibold text-violet-300 hover:text-violet-200">Manage topics →</Link>
            </div>
            {profile?.topics.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.topics.map((topic) => (
                  <span key={topic.id ?? topic.topic_name} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200">
                    {topic.topic_name} <span className="ml-1 text-slate-500">· {topic.difficulty}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Add topics to your profile to personalize your speaking challenges.</p>
            )}
          </article>
          <article className="flex flex-col justify-between rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">A little practice goes a long way</p>
              <h2 className="mt-3 text-xl font-bold">Build confidence one answer at a time.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Record your answer or type it out. We&apos;ll help you find the next step.</p>
            </div>
            <Link href="/game?mode=spinner" className="mt-6 text-sm font-bold text-cyan-200 hover:text-white">Start a quick challenge →</Link>
          </article>
        </section>
      </section>
    </main>
  );
}
