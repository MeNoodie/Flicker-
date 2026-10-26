"use client";

import React, { useState } from "react";
import type { GeneratedQuestionItem } from "@/types";

interface MysteryCardsProps {
  questions: GeneratedQuestionItem[];
  onSelectQuestion: (question: GeneratedQuestionItem) => void;
  isLoading: boolean;
  onRefreshQuestions: () => void;
}

export function MysteryCards({
  questions,
  onSelectQuestion,
  isLoading,
  onRefreshQuestions,
}: MysteryCardsProps) {
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);

  // Take 9 questions for a 3x3 grid
  const cardsQuestions = questions.slice(0, 9);

  const handleCardClick = (index: number) => {
    // Prevent additional selections once a card is locked in
    if (selectedCardIndex !== null) return;
    setSelectedCardIndex(index);
  };

  const selectedQuestion = selectedCardIndex !== null ? cardsQuestions[selectedCardIndex] : null;

  const handleResetCards = () => {
    setSelectedCardIndex(null);
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

  return (
    <div className="flex flex-col items-center max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
          🃏 Mystery Cards Challenge
        </h2>
        <p className="mt-2 text-sm text-zinc-400 max-w-xl mx-auto">
          Nine cards are dealt face-down with personalized interview challenges. Pick one card to reveal your speaking prompt!
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-4">
          <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-sm text-zinc-400 animate-pulse">Dealing mystery challenge cards...</p>
        </div>
      ) : cardsQuestions.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center max-w-md">
          <p className="text-zinc-300 font-medium">No questions currently available.</p>
          <button
            onClick={onRefreshQuestions}
            className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold"
          >
            Generate Questions
          </button>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center gap-8">
          {/* 3x3 Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 w-full max-w-3xl">
            {cardsQuestions.map((q, idx) => {
              const isSelected = selectedCardIndex === idx;
              const isLocked = selectedCardIndex !== null && !isSelected;

              return (
                <div
                  key={q.id || idx}
                  onClick={() => handleCardClick(idx)}
                  className={`relative h-44 rounded-2xl cursor-pointer transition-all duration-300 select-none p-5 flex flex-col justify-between border ${
                    isSelected
                      ? "bg-gradient-to-br from-violet-950 via-zinc-900 to-indigo-950 border-violet-500 shadow-2xl shadow-violet-500/30 scale-105 z-10"
                      : isLocked
                      ? "bg-zinc-900/40 border-zinc-800/50 opacity-40 cursor-not-allowed"
                      : "bg-zinc-900 hover:bg-zinc-800/80 border-zinc-800 hover:border-zinc-700 hover:scale-[1.02] shadow-lg"
                  }`}
                >
                  {/* Card Front (revealed if selected) */}
                  {isSelected ? (
                    <div className="flex flex-col justify-between h-full animate-fadeIn">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                            Card #{idx + 1}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getDifficultyBadge(
                              q.difficulty
                            )}`}
                          >
                            {q.difficulty}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-100 line-clamp-3 leading-snug">
                          {q.question}
                        </h4>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 font-medium">
                        <span className="truncate max-w-[120px]">{q.topic_name}</span>
                        <span className="text-amber-400 font-semibold">{q.target_duration_seconds}s</span>
                      </div>
                    </div>
                  ) : (
                    /* Card Back (mystery face-down pattern) */
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-2">
                        <span className="text-xl">✨</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-300">Mystery Card #{idx + 1}</span>
                      <span className="text-[10px] text-zinc-500 mt-1">Click to reveal</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Bar when a question is selected */}
          {selectedQuestion && (
            <div className="w-full max-w-xl bg-zinc-900 border border-violet-500/30 rounded-2xl p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-400 block mb-1">
                  Card Revealed & Locked
                </span>
                <p className="text-sm font-semibold text-white line-clamp-2">
                  {selectedQuestion.question}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-zinc-400">
                  <span>Topic: {selectedQuestion.topic_name}</span>
                  <span>•</span>
                  <span className="text-amber-400 font-semibold">{selectedQuestion.target_duration_seconds}s</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleResetCards}
                  className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
                >
                  Pick Another
                </button>
                <button
                  onClick={() => onSelectQuestion(selectedQuestion)}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-violet-600/25 transition text-xs flex items-center gap-1.5"
                >
                  <span>🎙️ Practice</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
