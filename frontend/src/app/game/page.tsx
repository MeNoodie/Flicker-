"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  EvaluationResult,
  GeneratedQuestionItem,
  PracticeSession,
  Profile,
  UserProgress,
} from "@/types";
import { getAccessToken } from "@/lib/auth";
import { ApiError, getProfile, getProgress, getQuestions } from "@/lib/api";
import { FeedbackDashboard } from "@/components/FeedbackDashboard";
import { MysteryCards } from "@/components/MysteryCards";
import { PracticeSessionView } from "@/components/PracticeSessionView";
import { TopicSpinner } from "@/components/TopicSpinner";
import { UserProgressHeader } from "@/components/UserProgressHeader";

type ActiveGame = "spinner" | "mystery_cards";

export default function SpeakQuestGame() {
  const router = useRouter();
  const [authToken, setAuthToken] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestionItem[]>([]);
  const [activeGame, setActiveGame] = useState<ActiveGame>("spinner");
  const [selectedQuestion, setSelectedQuestion] = useState<GeneratedQuestionItem | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [completedSession, setCompletedSession] = useState<PracticeSession | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadSession() {
      try {
        const token = await getAccessToken();
        if (!token) {
          router.replace("/login");
          return;
        }
        if (!active) return;
        const requestedGame = new URLSearchParams(window.location.search).get("mode");
        if (requestedGame === "mystery_cards" || requestedGame === "spinner") {
          setActiveGame(requestedGame);
        }
        setAuthToken(token);
      } catch (sessionError) {
        if (active) {
          setBannerNotice(sessionError instanceof Error ? sessionError.message : "Could not validate your session.");
          setIsLoadingProfile(false);
        }
      }
    }
    void loadSession();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    async function loadPractice() {
      try {
        const savedProfile = await getProfile(authToken);
        if (!active) return;
        setProfile(savedProfile);
        try {
          const savedProgress = await getProgress(authToken);
          if (active) setProgress(savedProgress);
        } catch (progressError) {
          console.warn("Could not load learning progress:", progressError);
        }
        if (!active) return;
        setIsLoadingQuestions(true);
        const questionResponse = await getQuestions(authToken, 10, false);
        if (active) setQuestions(questionResponse.questions);
      } catch (loadError) {
        if (!active) return;
        if (loadError instanceof ApiError && loadError.status === 404) {
          router.replace("/profile?setup=1");
        } else {
          setBannerNotice(loadError instanceof Error ? loadError.message : "Could not load practice data.");
        }
      } finally {
        if (active) {
          setIsLoadingProfile(false);
          setIsLoadingQuestions(false);
        }
      }
    }
    void loadPractice();
    return () => {
      active = false;
    };
  }, [authToken, reloadKey, router]);

  const handleRefreshQuestions = async () => {
    if (!authToken) return;
    setIsLoadingQuestions(true);
    try {
      const questionResponse = await getQuestions(authToken, 10, true);
      setQuestions(questionResponse.questions);
      setBannerNotice("Fresh personalized questions are ready.");
      window.setTimeout(() => setBannerNotice(null), 3000);
    } catch (refreshError) {
      setBannerNotice(refreshError instanceof Error ? refreshError.message : "Failed to refresh questions.");
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleEvaluationComplete = async (
    result: EvaluationResult,
    session: PracticeSession
  ) => {
    setEvaluationResult(result);
    setCompletedSession(session);
    try {
      setProgress(await getProgress(authToken));
    } catch (progressError) {
      console.warn("Could not reload learning progress:", progressError);
    }
  };

  const handleNextChallenge = () => {
    setEvaluationResult(null);
    setCompletedSession(null);
    setSelectedQuestion(null);
  };

  const handleRetryQuestion = () => {
    setEvaluationResult(null);
    setCompletedSession(null);
  };

  if (isLoadingProfile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050b17] text-slate-300">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-300" />
          <p className="mt-4 text-sm">Getting your practice ready…</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050b17] px-5 text-white">
        <section className="max-w-md rounded-2xl border border-white/10 bg-[#0b1425] p-7">
          <h1 className="text-lg font-bold">Practice is temporarily unavailable</h1>
          <p role="alert" className="mt-2 text-sm leading-6 text-slate-300">{bannerNotice ?? "We could not load your learner profile."}</p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => {
                setBannerNotice(null);
                setIsLoadingProfile(true);
                setReloadKey((key) => key + 1);
              }}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold"
            >
              Try again
            </button>
            <Link href="/dashboard" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold">Dashboard</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#050b17] text-slate-100">
      <UserProgressHeader
        profile={profile}
        progress={progress}
        onOpenProfile={() => router.push("/profile")}
        activeGame={activeGame}
        onSelectGame={(game) => {
          if (!selectedQuestion) {
            setActiveGame(game);
            router.replace(`/game?mode=${game}`);
          }
        }}
      />
      <div className="border-b border-white/10 bg-[#081120]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6">
          <Link href="/dashboard" className="text-xs font-semibold text-slate-400 transition hover:text-white">← Dashboard</Link>
          <span className="text-xs text-slate-500">Practice · Speak · Improve</span>
          <Link href="/profile" className="text-xs font-semibold text-violet-300 transition hover:text-violet-200">Edit profile</Link>
        </div>
      </div>
      {bannerNotice && (
        <div role="status" className="border-b border-violet-300/10 bg-violet-400/10 px-4 py-2 text-center text-xs font-semibold text-violet-100">
          {bannerNotice}
        </div>
      )}
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        {evaluationResult && completedSession ? (
          <FeedbackDashboard
            result={evaluationResult}
            session={completedSession}
            onNextQuestion={handleNextChallenge}
            onRetry={handleRetryQuestion}
          />
        ) : selectedQuestion ? (
          <PracticeSessionView
            key={`${selectedQuestion.id}-${evaluationResult ? "retry" : "first"}`}
            question={selectedQuestion}
            gameType={activeGame}
            authToken={authToken}
            onEvaluationComplete={handleEvaluationComplete}
            onCancel={() => setSelectedQuestion(null)}
          />
        ) : (
          <div className="py-4">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Your next challenge</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  {activeGame === "spinner" ? "Spin to speak." : "Choose a mystery card."}
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  {activeGame === "spinner"
                    ? "Spin the wheel to get a speaking prompt tailored to your topics."
                    : "Pick a face-down card and explain the topic it reveals."}
                </p>
              </div>
              <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
                {profile.domain} · {profile.experience_level}
              </span>
            </div>
            {activeGame === "spinner" ? (
              <TopicSpinner
                questions={questions}
                onSelectQuestion={setSelectedQuestion}
                isLoading={isLoadingQuestions}
                onRefreshQuestions={handleRefreshQuestions}
              />
            ) : (
              <MysteryCards
                questions={questions}
                onSelectQuestion={setSelectedQuestion}
                isLoading={isLoadingQuestions}
                onRefreshQuestions={handleRefreshQuestions}
              />
            )}
          </div>
        )}
      </section>
    </main>
  );
}
