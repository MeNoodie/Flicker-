"use client";

import React from "react";
import type { Profile, UserProgress } from "@/types";

interface UserProgressHeaderProps {
  profile: Profile | null;
  progress: UserProgress | null;
  onOpenProfile: () => void;
  activeGame: "spinner" | "mystery_cards";
  onSelectGame: (game: "spinner" | "mystery_cards") => void;
}

export function UserProgressHeader({
  profile,
  progress,
  onOpenProfile,
  activeGame,
  onSelectGame,
}: UserProgressHeaderProps) {
  return (
    <header className="w-full bg-zinc-900/90 border-b border-zinc-800 backdrop-blur sticky top-0 z-30 px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand & Persona badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-violet-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-white font-bold text-lg">SQ</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-tight">SpeakQuest AI</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {profile?.user_type === "student" ? "🎓 Student" : "💼 Professional"}
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate max-w-[280px]">
              {profile?.domain || "Software Engineering"} • {profile?.experience_level || "intermediate"}
            </p>
          </div>
        </div>

        {/* Game Mode Tabs */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => onSelectGame("spinner")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeGame === "spinner"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            🎡 Topic Spinner
          </button>
          <button
            onClick={() => onSelectGame("mystery_cards")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeGame === "mystery_cards"
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            🃏 Mystery Cards
          </button>
        </div>

        {/* Stats & Profile trigger */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-amber-400" title="Total XP">
              <span>⚡</span>
              <span>{progress?.total_xp ?? 0} XP</span>
            </div>
            <div className="h-3.5 w-px bg-zinc-800" />
            <div className="flex items-center gap-1.5 text-orange-400" title="Daily Streak">
              <span>🔥</span>
              <span>{progress?.current_streak ?? 0}d</span>
            </div>
            <div className="h-3.5 w-px bg-zinc-800" />
            <div className="flex items-center gap-1.5 text-emerald-400" title="Completed Sessions">
              <span>🎯</span>
              <span>{progress?.completed_sessions ?? 0}</span>
            </div>
          </div>

          <button
            onClick={onOpenProfile}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
          >
            ⚙️ Preferences
          </button>
        </div>
      </div>
    </header>
  );
}
