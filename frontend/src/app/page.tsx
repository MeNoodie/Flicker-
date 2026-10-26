import Link from "next/link";

const benefits = [
  ["01", "Choose your domain", "Practice the topics that matter to your work or studies."],
  ["02", "Speak it out loud", "Answer real prompts with a voice recording or typed response."],
  ["03", "Get useful feedback", "See a clear score, strengths, and what to improve next."],
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b17] text-white">
      <div className="app-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute -top-48 right-[-10rem] h-[36rem] w-[36rem] rounded-full bg-violet-700/20 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-[-18rem] left-[-8rem] h-[34rem] w-[34rem] rounded-full bg-cyan-500/10 blur-[130px]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="SpeakQuest home">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-black shadow-lg shadow-violet-950/50">
            S
          </span>
          <span className="text-lg font-bold tracking-tight">SpeakQuest</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white">
            Log in
          </Link>
          <Link href="/signup" className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold shadow-lg shadow-violet-950/40 transition hover:bg-violet-500">
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-28 lg:pt-20">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-violet-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            YOUR IDEAS, CLEARLY EXPLAINED
          </div>
          <h1 className="text-5xl font-bold leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">
            Turn your knowledge into{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              real confidence.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            Practice explaining what you know, one challenge at a time. Get
            thoughtful AI feedback that helps you speak with clarity and confidence.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/login" className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 text-sm font-bold shadow-xl shadow-violet-950/50 transition hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500">
              Start practicing <span aria-hidden="true">→</span>
            </Link>
            <span className="text-sm text-slate-400">Free to get started · No credit card</span>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-300">
            <span><span className="mr-2 text-emerald-300">✓</span>Personalized topics</span>
            <span><span className="mr-2 text-emerald-300">✓</span>Instant feedback</span>
            <span><span className="mr-2 text-emerald-300">✓</span>Track your progress</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-violet-600/20 via-indigo-500/10 to-cyan-400/10 blur-2xl" />
          <div className="relative rounded-[1.75rem] border border-white/10 bg-[#0b1425]/90 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Today&apos;s practice</p>
                <h2 className="mt-1 text-lg font-bold">Your confidence is building</h2>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">Ready</span>
            </div>
            <div className="mt-6 rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/20 text-violet-200">✦</span>
                YOUR SPEAKING CHALLENGE
              </div>
              <p className="mt-4 text-xl font-semibold leading-relaxed">
                Explain a complex idea as if you were teaching a teammate.
              </p>
              <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
                <span>Practice at your own pace</span>
                <span className="rounded-lg bg-white/5 px-2.5 py-1.5 text-slate-300">90 seconds</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ["🎡", "Topic Spinner"],
                ["🃏", "Mystery Cards"],
                ["📈", "Your progress"],
              ].map(([icon, label]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                  <span className="text-xl" aria-hidden="true">{icon}</span>
                  <p className="mt-2 text-[11px] font-medium text-slate-300">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-[#07101e] p-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">✓</span>
              <div className="flex-1">
                <p className="text-xs font-semibold">Feedback made for you</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Clarity · Accuracy · Confidence</p>
              </div>
              <span className="text-sm font-bold text-cyan-200">86</span>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-8 hidden rounded-xl border border-white/10 bg-[#111c30] px-4 py-3 shadow-xl sm:block">
            <p className="text-xs font-semibold text-white">Small steps add up</p>
            <p className="mt-1 text-[11px] text-slate-400">Your next great explanation starts here.</p>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20 lg:px-10">
        <div className="mb-8 max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">How it works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">Make every practice count.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {benefits.map(([number, title, description]) => (
            <article key={number} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
              <span className="text-xs font-bold tracking-widest text-violet-300">{number}</span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="relative z-10 border-t border-white/10 px-6 py-6 text-center text-xs text-slate-500">
        SpeakQuest · Practice makes your thinking easier to share.
      </footer>
    </main>
  );
}
