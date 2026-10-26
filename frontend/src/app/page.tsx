"use client";

import React, { useState, useEffect, useCallback } from "react";
import type {
  Profile,
  UserProgress,
  GeneratedQuestionItem,
  EvaluationResult,
  PracticeSession,
  UpsertProfileRequest,
} from "@/types";
import {
  getProfile,
  upsertProfile,
  getProgress,
  getQuestions,
} from "@/lib/api";
import { UserProgressHeader } from "@/components/UserProgressHeader";
import { TopicSpinner } from "@/components/TopicSpinner";
import { MysteryCards } from "@/components/MysteryCards";
import { PracticeSessionView } from "@/components/PracticeSessionView";
import { FeedbackDashboard } from "@/components/FeedbackDashboard";
import { ProfileModal } from "@/components/ProfileModal";

export default function SpeakQuestHome() {
  // Use mock/dev token for local testing and offline fallback
  const [authToken] = useState<string>("mock-user-123");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestionItem[]>([]);
  const [activeGame, setActiveGame] = useState<"spinner" | "mystery_cards">("spinner");

  // Workflow states
  const [selectedQuestion, setSelectedQuestion] = useState<GeneratedQuestionItem | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [completedSession, setCompletedSession] = useState<PracticeSession | null>(null);

  // UI state
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Initial data load
  const loadInitialData = useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      // 1. Load or initialize profile
      let prof: Profile | null = null;
      try {
        prof = await getProfile(authToken);
      } catch {
        // Fallback profile if new user
        prof = await upsertProfile(authToken, {
          display_name: "Alex Chen",
          domain: "Distributed Systems & Cloud Architecture",
          experience_level: "intermediate",
          learning_goal: "interview_preparation",
          preferred_duration: 90,
          user_type: "student",
          college_year: "3rd_year",
          institution_name: "Stanford University",
          major_degree: "Computer Science",
          topics: [
            { topic_name: "CAP Theorem & PACELC Tradeoffs", difficulty: "intermediate", is_active: true },
            { topic_name: "Raft Consensus Algorithm", difficulty: "advanced", is_active: true },
            { topic_name: "Distributed Caching & Invalidation", difficulty: "intermediate", is_active: true },
            { topic_name: "Database Sharding & Partitioning", difficulty: "advanced", is_active: true },
          ],
        });
      }
      setProfile(prof);

      // 2. Load User Progress
      try {
        const prog = await getProgress(authToken);
        setProgress(prog);
      } catch {
        setProgress({
          user_id: "mock-user-123",
          total_xp: 0,
          current_streak: 1,
          completed_sessions: 0,
          last_practice_date: new Date().toISOString().split("T")[0],
        });
      }

      // 3. Load Questions
      setIsLoadingQuestions(true);
      const qRes = await getQuestions(authToken, 10, false);
      setQuestions(qRes.questions);
    } catch (err: unknown) {
      console.error("Failed to load initial data:", err);
      setBannerNotice(err instanceof Error ? err.message : "Error connecting to backend");
    } finally {
      setIsLoadingProfile(false);
      setIsLoadingQuestions(false);
    }
  }, [authToken]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Refresh questions handler
  const handleRefreshQuestions = async () => {
    setIsLoadingQuestions(true);
    try {
      const qRes = await getQuestions(authToken, 10, true);
      setQuestions(qRes.questions);
      setBannerNotice("✨ Generated fresh personalized questions!");
      setTimeout(() => setBannerNotice(null), 3000);
    } catch (err: unknown) {
      setBannerNotice(err instanceof Error ? err.message : "Failed to refresh questions");
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // Handle saving profile changes from modal
  const handleSaveProfile = async (updated: UpsertProfileRequest) => {
    const saved = await upsertProfile(authToken, updated);
    setProfile(saved);
    // Refresh questions so AI agent adopts the new persona/topics
    await handleRefreshQuestions();
  };

  // Callback when evaluation finishes in PracticeSessionView
  const handleEvaluationComplete = async (
    result: EvaluationResult,
    session: PracticeSession
  ) => {
    setEvaluationResult(result);
    setCompletedSession(session);

    // Refresh progress to display updated XP and streak
    try {
      const prog = await getProgress(authToken);
      setProgress(prog);
    } catch (e) {
      console.warn("Could not reload progress:", e);
    }
  };

  // Reset to game board for next challenge
  const handleNextChallenge = () => {
    setEvaluationResult(null);
    setCompletedSession(null);
    setSelectedQuestion(null);
  };

  // Retry the exact same question
  const handleRetryQuestion = () => {
    setEvaluationResult(null);
    setCompletedSession(null);
    // Keep selectedQuestion so PracticeSessionView re-mounts
  };

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 font-medium text-sm animate-pulse">
          Connecting to SpeakQuest AI & calibrating profile...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Sticky Header with XP, Streak & Game Tabs */}
      <UserProgressHeader
        profile={profile}
        progress={progress}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        activeGame={activeGame}
        onSelectGame={(g) => {
          if (!selectedQuestion) setActiveGame(g);
        }}
      />

      {/* Temporary Toast Banner */}
      {bannerNotice && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 text-center text-xs text-amber-300 font-semibold animate-fade-in">
          {bannerNotice}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {/* Step 1: Active Evaluation Feedback View */}
        {evaluationResult && completedSession ? (
          <FeedbackDashboard
            result={evaluationResult}
            session={completedSession}
            onNextQuestion={handleNextChallenge}
            onRetry={handleRetryQuestion}
          />
        ) : selectedQuestion ? (
          /* Step 2: Active Practice Session with Audio & Fallback */
          <PracticeSessionView
            question={selectedQuestion}
            gameType={activeGame}
            authToken={authToken}
            onEvaluationComplete={handleEvaluationComplete}
            onCancel={() => setSelectedQuestion(null)}
          />
        ) : (
          /* Step 3: Game Selection (Spinner or Mystery Cards) */
          <div className="py-6 space-y-8 animate-fade-in">
            {/* Hero / Game Mode Overview */}
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-zinc-900 border border-zinc-800 text-amber-400">
                ⚡ Interactive AI Speaking Practice
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {activeGame === "spinner" ? "Spin to Speak" : "Mystery Knowledge Cards"}
              </h2>
              <p className="text-sm text-zinc-400">
                {activeGame === "spinner"
                  ? "Spin the wheel to land on an AI-curated question tailored to your persona."
                  : "Choose a face-down card to test your domain reflexes under pressure."}
              </p>
            </div>

            {/* Game Canvas */}
            {activeGame === "spinner" ? (
              <TopicSpinner
                questions={questions}
                onSelectQuestion={(q) => setSelectedQuestion(q)}
                isLoading={isLoadingQuestions}
                onRefreshQuestions={handleRefreshQuestions}
              />
            ) : (
              <MysteryCards
                questions={questions}
                onSelectQuestion={(q) => setSelectedQuestion(q)}
                isLoading={isLoadingQuestions}
                onRefreshQuestions={handleRefreshQuestions}
              />
            )}
          </div>
        )}
      </main>

      {/* Profile & Custom Topics Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        profile={profile}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveProfile}
      />
    </div>
  );
}
