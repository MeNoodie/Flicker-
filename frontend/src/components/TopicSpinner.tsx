"use client";

import React, { useState } from "react";
import type { GeneratedQuestionItem } from "@/types";

interface TopicSpinnerProps {
  questions: GeneratedQuestionItem[];
  onSelectQuestion: (question: GeneratedQuestionItem) => void;
  isLoading: boolean;
  onRefreshQuestions: () => void;
}

export function TopicSpinner({
  questions,
  onSelectQuestion,
  isLoading,
  onRefreshQuestions,
}: TopicSpinnerProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<GeneratedQuestionItem | null>(null);

  // Use up to 8 slices on the wheel for clean visual readability
  const activeQuestions = questions.slice(0, 8);
  const sliceCount = Math.max(1, activeQuestions.length);
  const sliceAngle = 360 / sliceCount;

  const handleSpin = () => {
    if (spinning || activeQuestions.length === 0) return;

    setSpinning(true);
    setSelectedQuestion(null);

    // Pick a deterministic random winning index
    const winningIndex = Math.floor(Math.random() * activeQuestions.length);
    const chosen = activeQuestions[winningIndex];

    // Calculate exact target rotation so the pointer (at top: 270 deg or 0 deg) points to winning slice
    // Pointer is at the top (angle 0 / 360). Slice i centers at i * sliceAngle + sliceAngle / 2
    const targetSliceAngle = winningIndex * sliceAngle + sliceAngle / 2;
    // We add 5 full rotations (1800 deg) + offset to align slice with the top indicator
    const extraRotations = 1800;
    const finalRotation = rotation + extraRotations + (360 - (rotation % 360)) + (360 - targetSliceAngle);

    setRotation(finalRotation);

    setTimeout(() => {
      setSpinning(false);
      setSelectedQuestion(chosen);
    }, 4000); // 4 second smooth deceleration animation
  };

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "advanced":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  const colors = [
    "#f59e0b", // amber
    "#8b5cf6", // violet
    "#10b981", // emerald
    "#06b6d4", // cyan
    "#ec4899", // pink
    "#3b82f6", // blue
    "#f97316", // orange
    "#6366f1", // indigo
  ];

  return (
    <div className="flex flex-col items-center max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
          🎡 Spoken Topic Spinner
        </h2>
        <p className="mt-2 text-sm text-zinc-400 max-w-xl mx-auto">
          Spin the wheel to get an AI-generated verbal interview question tailored to your domain & experience.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-sm text-zinc-400 animate-pulse">Generating personalized question bank with AI...</p>
        </div>
      ) : activeQuestions.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center max-w-md">
          <p className="text-zinc-300 font-medium">No questions currently available.</p>
          <button
            onClick={onRefreshQuestions}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold"
          >
            Generate Questions
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-12 w-full justify-center">
          {/* Wheel Container */}
          <div className="relative flex items-center justify-center">
            {/* Top Pointer Indicator */}
            <div className="absolute -top-4 z-20 w-0 h-0 border-x-8 border-x-transparent border-t-[20px] border-t-amber-400 filter drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]" />

            {/* SVG Wheel */}
            <div
              className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full border-4 border-zinc-700 shadow-2xl overflow-hidden transition-transform ease-out"
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: spinning ? "4000ms" : "0ms",
                transitionTimingFunction: "cubic-bezier(0.15, 0.9, 0.2, 1)",
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {activeQuestions.map((q, i) => {
                  const startAngle = (i * 360) / sliceCount;
                  const endAngle = ((i + 1) * 360) / sliceCount;
                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = (endAngle * Math.PI) / 180;
                  const x1 = 50 + 50 * Math.cos(startRad);
                  const y1 = 50 + 50 * Math.sin(startRad);
                  const x2 = 50 + 50 * Math.cos(endRad);
                  const y2 = 50 + 50 * Math.sin(endRad);
                  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                  const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`;

                  return (
                    <path
                      key={q.id}
                      d={pathData}
                      fill={colors[i % colors.length]}
                      stroke="#18181b"
                      strokeWidth="0.8"
                      className="opacity-90 hover:opacity-100 transition-opacity"
                    />
                  );
                })}
              </svg>

              {/* Slice Labels */}
              <div className="absolute inset-0 pointer-events-none">
                {activeQuestions.map((q, i) => {
                  const midAngle = (i * 360) / sliceCount + sliceAngle / 2;
                  return (
                    <div
                      key={q.id}
                      className="absolute inset-0 flex items-start justify-center pt-3 text-[10px] font-bold text-white uppercase tracking-wider drop-shadow"
                      style={{
                        transform: `rotate(${midAngle}deg)`,
                        transformOrigin: "center center",
                      }}
                    >
                      <span className="truncate max-w-[70px]">{q.topic_name.split(" ")[0]}</span>
                    </div>
                  );
                })}
              </div>

              {/* Center Hub */}
              <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-zinc-950 border-4 border-zinc-700 flex items-center justify-center shadow-inner z-10">
                <span className="text-amber-400 font-extrabold text-xs">SPIN</span>
              </div>
            </div>
          </div>

          {/* Controls & Selected Question Info */}
          <div className="flex-1 max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {selectedQuestion ? "Selected Challenge" : "Ready to Spin"}
                </span>
                <button
                  onClick={onRefreshQuestions}
                  disabled={spinning}
                  className="text-xs text-zinc-400 hover:text-white transition flex items-center gap-1 disabled:opacity-50"
                  title="Generate fresh questions"
                >
                  🔄 Refresh
                </button>
              </div>

              {selectedQuestion ? (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700">
                      {selectedQuestion.topic_name}
                    </span>
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getDifficultyBadge(
                        selectedQuestion.difficulty
                      )}`}
                    >
                      {selectedQuestion.difficulty}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      ⏱️ {selectedQuestion.target_duration_seconds}s
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white leading-snug">
                    {selectedQuestion.question}
                  </h3>

                  <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/80 text-xs text-zinc-300">
                    <span className="text-zinc-400 font-semibold block mb-1">Key concepts expected:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedQuestion.expected_concepts.map((c, i) => (
                        <span key={i} className="bg-zinc-800 px-2 py-0.5 rounded text-[11px] text-zinc-300">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-zinc-400">
                    Hit the spin button to let the wheel pick your next spoken practice question.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={handleSpin}
                disabled={spinning}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {spinning ? "🎡 Spinning..." : "Spin the Wheel!"}
              </button>

              {selectedQuestion && (
                <button
                  onClick={() => onSelectQuestion(selectedQuestion)}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/25 transition text-sm flex items-center justify-center gap-2"
                >
                  <span>🎙️ Start Practice Session</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
