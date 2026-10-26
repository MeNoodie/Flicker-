"use client";

import React, { useState, useEffect, useRef } from "react";
import type { GeneratedQuestionItem, PracticeSession, EvaluationResult } from "@/types";
import { createSession, transcribeAudio, submitTypedAnswer, evaluateSession } from "@/lib/api";

interface PracticeSessionViewProps {
  question: GeneratedQuestionItem;
  gameType: "spinner" | "mystery_cards";
  authToken: string;
  onEvaluationComplete: (result: EvaluationResult, session: PracticeSession) => void;
  onCancel: () => void;
}

type SessionState = "ready" | "recording" | "submitting" | "transcribing" | "evaluating" | "error";

export function PracticeSessionView({
  question,
  gameType,
  authToken,
  onEvaluationComplete,
  onCancel,
}: PracticeSessionViewProps) {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Timing
  const targetDuration = question.target_duration_seconds || 90;
  const hardMaxDuration = 180;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Audio Recording
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fallback Typed Answer
  const [typedAnswer, setTypedAnswer] = useState("");
  const [isUsingTypedFallback, setIsUsingTypedFallback] = useState(false);

  const stopMediaStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;
    async function initSession() {
      try {
        const resp = await createSession(authToken, {
          topic_id: question.topic_id,
          game_type: gameType,
          question_id: question.id,
          question: question.question,
          difficulty: question.difficulty,
          target_duration_seconds: targetDuration,
          expected_concepts: question.expected_concepts,
          evaluation_hints: question.evaluation_hints,
        });
        if (isMounted) {
          setSession(resp.session);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to initialize practice session"
          );
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
      stopMediaStream();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [question, gameType, authToken, targetDuration]);

  // Start recording
  const startRecording = async () => {
    setErrorMessage(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(fullBlob);
        stopMediaStream();
      };

      recorder.start(250); // Slice every 250ms
      setSessionState("recording");
      setElapsedSeconds(0);

      // Start elapsed timer
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          // Auto-stop at hard limit 180s or target limit
          if (next >= hardMaxDuration) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      setIsUsingTypedFallback(true);
      setErrorMessage("Microphone access unavailable or denied. You can type your answer below instead.");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    setSessionState("submitting");
  };

  // Submit recorded audio -> Transcribe -> Evaluate
  const handleSubmitAudio = async () => {
    if (!session || !audioBlob) return;

    setSessionState("transcribing");
    setErrorMessage(null);

    try {
      // 1. Transcribe
      const transcribeResp = await transcribeAudio(
        authToken,
        session.id,
        audioBlob,
        "recording.webm"
      );

      if (transcribeResp.needs_retry) {
        setSessionState("ready");
        setErrorMessage("Your speech was too short or unclear. Please try again with a fuller answer.");
        return;
      }

      // 2. Evaluate
      setSessionState("evaluating");
      const evalResp = await evaluateSession(authToken, {
        session_id: session.id,
      });

      if (!evalResp.success || !evalResp.result) {
        throw new Error(evalResp.retry_reason || "Evaluation could not be completed.");
      }

      onEvaluationComplete(evalResp.result, session);
    } catch (err: unknown) {
      setSessionState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to transcribe or evaluate audio."
      );
    }
  };

  // Submit typed fallback answer
  const handleSubmitTyped = async () => {
    if (!session || !typedAnswer.trim()) return;

    setSessionState("submitting");
    setErrorMessage(null);

    try {
      await submitTypedAnswer(authToken, session.id, typedAnswer.trim(), elapsedSeconds || 60);

      setSessionState("evaluating");
      const evalResp = await evaluateSession(authToken, {
        session_id: session.id,
      });

      if (!evalResp.success || !evalResp.result) {
        throw new Error(evalResp.retry_reason || "Evaluation could not be completed.");
      }

      onEvaluationComplete(evalResp.result, session);
    } catch (err: unknown) {
      setSessionState("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to evaluate answer.");
    }
  };

  // Formatting helpers
  const remainingSeconds = Math.max(0, targetDuration - elapsedSeconds);
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Session Box */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        {/* Top meta */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
              {question.topic_name}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {question.difficulty}
            </span>
          </div>

          <button
            onClick={onCancel}
            disabled={sessionState === "transcribing" || sessionState === "evaluating"}
            className="text-xs text-zinc-400 hover:text-white transition disabled:opacity-50"
          >
            ✕ Cancel
          </button>
        </div>

        {/* Question Prompt */}
        <div className="mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-500 block mb-2">
            Speaking Challenge
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-relaxed">
            {question.question}
          </h2>

          <div className="mt-4 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-300">
            <span className="text-zinc-400 font-semibold block mb-1">Key concepts to incorporate:</span>
            <div className="flex flex-wrap gap-1.5">
              {question.expected_concepts.map((concept, i) => (
                <span key={i} className="bg-zinc-800/80 px-2 py-0.5 rounded text-[11px] text-zinc-200">
                  {concept}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 font-bold ml-2 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* State Machine Views */}
        {sessionState === "transcribing" || sessionState === "evaluating" ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <h3 className="text-base font-bold text-white">
              {sessionState === "transcribing"
                ? "🎙️ Transcribing Audio with Groq Whisper..."
                : "🧠 LangGraph Evaluator Agent Analyzing Answer..."}
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Scoring clarity, depth, conceptual accuracy, and technical precision against the reference rubric.
            </p>
          </div>
        ) : isUsingTypedFallback ? (
          /* Typed Fallback View */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Type your response (spoken practice fallback)</span>
              <span>{typedAnswer.split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <textarea
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              placeholder="Structure your answer: explain the core mechanism, compare trade-offs, and describe a real-world scenario..."
              rows={6}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition resize-none"
            />
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setIsUsingTypedFallback(false)}
                className="text-xs text-zinc-400 hover:text-white transition"
              >
                🎙️ Try Microphone Again
              </button>
              <button
                onClick={handleSubmitTyped}
                disabled={typedAnswer.trim().length < 15}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-500/25 transition disabled:opacity-50"
              >
                Submit Answer for Evaluation
              </button>
            </div>
          </div>
        ) : (
          /* Voice Recording Mode */
          <div className="flex flex-col items-center py-6 space-y-6">
            {/* Timer Display */}
            <div className="flex items-center gap-8 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Elapsed</span>
                <span className="text-2xl font-mono font-bold text-zinc-200">{formatTime(elapsedSeconds)}</span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Target Left</span>
                <span
                  className={`text-2xl font-mono font-bold ${
                    remainingSeconds < 15 ? "text-rose-400 animate-pulse" : "text-amber-400"
                  }`}
                >
                  {formatTime(remainingSeconds)}
                </span>
              </div>
            </div>

            {/* Recording Controls */}
            {sessionState === "ready" && (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={startRecording}
                  className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 flex items-center justify-center text-white shadow-xl shadow-rose-600/30 transition transform hover:scale-105"
                >
                  <span className="text-3xl">🎙️</span>
                </button>
                <span className="text-xs text-zinc-400 font-medium">Click to Start Speaking</span>
              </div>
            )}

            {sessionState === "recording" && (
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
                  <button
                    onClick={stopRecording}
                    className="relative w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-600/40 transition"
                  >
                    <span className="w-6 h-6 rounded bg-white" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-semibold text-rose-400">Recording live... (Click square to stop)</span>
                </div>
              </div>
            )}

            {sessionState === "submitting" && audioBlob && (
              <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                <div className="w-full bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex items-center justify-between text-xs text-zinc-300">
                  <span>Audio Recorded ({formatTime(elapsedSeconds)})</span>
                  <span className="text-emerald-400 font-semibold">✓ Ready</span>
                </div>
                <div className="flex items-center gap-3 w-full">
                  <button
                    onClick={startRecording}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                  >
                    🔄 Re-record
                  </button>
                  <button
                    onClick={handleSubmitAudio}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition"
                  >
                    Evaluate Answer
                  </button>
                </div>
              </div>
            )}

            {/* Fallback link */}
            <div className="pt-4 border-t border-zinc-800/60 w-full text-center">
              <button
                onClick={() => setIsUsingTypedFallback(true)}
                className="text-xs text-zinc-400 hover:text-amber-400 transition"
              >
                Having mic issues? Switch to typed answer fallback
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
