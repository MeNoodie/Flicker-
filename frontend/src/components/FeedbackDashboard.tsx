"use client";

import React, { useState } from "react";
import type { EvaluationResult, PracticeSession } from "@/types";

interface FeedbackDashboardProps {
  result: EvaluationResult;
  session: PracticeSession;
  onNextQuestion: () => void;
  onRetry: () => void;
}

export function FeedbackDashboard({
  result,
  session,
  onNextQuestion,
  onRetry,
}: FeedbackDashboardProps) {
  const [activeTab, setActiveTab] = useState<"feedback" | "transcript" | "model_answer">("feedback");

  const dimensionWeights: Record<string, { label: string; weight: number }> = {
    conceptual_accuracy: { label: "Conceptual Accuracy", weight: 30 },
    concept_clarity: { label: "Concept Clarity", weight: 20 },
    depth_of_understanding: { label: "Depth of Understanding", weight: 20 },
    technical_precision: { label: "Technical Precision", weight: 15 },
    structure_and_reasoning: { label: "Structure & Reasoning", weight: 10 },
    relevance: { label: "Relevance", weight: 5 },
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 60) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner: Score & XP Summary */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Overall Score Circle */}
            <div
              className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center border-2 shadow-inner shrink-0 ${getScoreColor(
                result.overall_score
              )}`}
            >
              <span className="text-3xl font-extrabold font-mono tracking-tight">
                {Math.round(result.overall_score)}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">/ 100</span>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                  Evaluation Complete
                </span>
                {result.xp_awarded > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    +{result.xp_awarded} XP Earned
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white line-clamp-2">
                {session.question}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Confidence: <span className="capitalize font-semibold text-zinc-200">{result.confidence}</span> • Mode: {session.game_type}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={onNextQuestion}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-500/25 transition"
            >
              Next Challenge →
            </button>
            <button
              onClick={onRetry}
              className="flex-1 sm:flex-none px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs border border-zinc-700 transition"
            >
              🔄 Retry Prompt
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("feedback")}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === "feedback"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          📊 Rubric Breakdown
        </button>
        <button
          onClick={() => setActiveTab("model_answer")}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === "model_answer"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          💡 Improved Model Answer
        </button>
        <button
          onClick={() => setActiveTab("transcript")}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === "transcript"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          📝 Candidate Transcript
        </button>
      </div>

      {/* Tab 1: Rubric & Dimensions */}
      {activeTab === "feedback" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Dimension Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(result.dimension_scores || {}).map(([key, item]) => {
              const meta = dimensionWeights[key] || { label: key, weight: 15 };
              const percent = Math.min(100, Math.max(0, (item.score / 5) * 100));

              return (
                <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-200">{meta.label}</span>
                    <span className="font-mono font-bold text-amber-400">
                      {item.score} / 5.0 <span className="text-zinc-500 font-normal">({meta.weight}%)</span>
                    </span>
                  </div>

                  {/* Progress meter */}
                  <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed italic">
                    &quot;{item.evidence || "Demonstrated baseline understanding."}&quot;
                  </p>
                </div>
              );
            })}
          </div>

          {/* Strengths & Improvement Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="bg-zinc-900 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <span>✨ Key Strengths</span>
              </div>
              <ul className="space-y-2">
                {result.strengths.length > 0 ? (
                  result.strengths.map((str, i) => (
                    <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{str}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-zinc-500">Good attempt — keep practicing to build strengths.</li>
                )}
              </ul>
            </div>

            {/* Improvement Areas */}
            <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <span>🎯 Improvement Areas</span>
              </div>
              <ul className="space-y-2">
                {result.improvement_areas.length > 0 ? (
                  result.improvement_areas.map((imp, i) => (
                    <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                      <span className="text-amber-400 font-bold">→</span>
                      <span>{imp}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-zinc-500">No major gaps identified!</li>
                )}
              </ul>
            </div>
          </div>

          {/* Misconceptions & Missing Concepts */}
          {(result.misconceptions.length > 0 || result.missing_concepts.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {result.misconceptions.length > 0 && (
                <div className="bg-zinc-900 border border-rose-500/20 rounded-2xl p-5 space-y-3">
                  <div className="text-rose-400 font-bold text-xs uppercase tracking-wider">
                    ⚠️ Misconceptions Corrected
                  </div>
                  <ul className="space-y-2">
                    {result.misconceptions.map((misc, i) => (
                      <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                        <span className="text-rose-400">✗</span>
                        <span>{misc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.missing_concepts.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <div className="text-zinc-400 font-bold text-xs uppercase tracking-wider">
                    🔍 Missing Recommended Concepts
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.missing_concepts.map((concept, i) => (
                      <span
                        key={i}
                        className="bg-zinc-950 px-2.5 py-1 rounded-lg text-xs text-zinc-300 border border-zinc-800"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Model Answer */}
      {activeTab === "model_answer" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
              Concise High-Scoring Response (60-90s)
            </span>
          </div>
          <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line bg-zinc-950 p-5 rounded-xl border border-zinc-800/80 font-serif">
            {result.improved_answer || "No model answer synthesized."}
          </p>
        </div>
      )}

      {/* Tab 3: Transcript */}
      {activeTab === "transcript" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 animate-fadeIn">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Raw Speech-to-Text Transcript (Groq Whisper)
          </span>
          <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-950 p-5 rounded-xl border border-zinc-800/80 font-mono">
            {result.transcript || "(No transcript available)"}
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-center text-[11px] text-zinc-400 pt-4">
        ⚖️ AI-generated assessment powered by LangGraph. Use for learning and communication practice.
      </p>
    </div>
  );
}
