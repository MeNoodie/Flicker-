"use client";

import React, { useState } from "react";
import type {
  Profile,
  UserType,
  ExperienceLevel,
  LearningGoal,
  CollegeYear,
  Topic,
  UpsertProfileRequest,
} from "@/types";

interface ProfileModalProps {
  isOpen: boolean;
  profile: Profile | null;
  initialName?: string;
  canClose?: boolean;
  onClose: () => void;
  onSave: (updated: UpsertProfileRequest) => Promise<void>;
}

export function ProfileModal({
  isOpen,
  profile,
  initialName,
  canClose = true,
  onClose,
  onSave,
}: ProfileModalProps) {
  const [userType, setUserType] = useState<UserType>(
    profile?.user_type || "student"
  );
  const [displayName, setDisplayName] = useState(
    profile?.display_name || initialName || ""
  );
  const [domain, setDomain] = useState(
    profile?.domain || ""
  );
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    profile?.experience_level || "beginner"
  );
  const [learningGoal, setLearningGoal] = useState<LearningGoal>(
    profile?.learning_goal || "concept_clarity"
  );

  // Student fields
  const [collegeYear, setCollegeYear] = useState<CollegeYear>(
    profile?.college_year || "1st_year"
  );
  const [institutionName, setInstitutionName] = useState(profile?.institution_name || "");
  const [majorDegree, setMajorDegree] = useState(profile?.major_degree || "");

  // Professional fields
  const [yearsOfExperience, setYearsOfExperience] = useState<number>(
    profile?.years_of_experience ?? 0
  );
  const [currentRole, setCurrentRole] = useState(profile?.current_role || "");
  const [targetRole, setTargetRole] = useState(profile?.target_role || "");

  // Custom topics
  const [topics, setTopics] = useState<Topic[]>(
    profile?.topics ?? []
  );
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDifficulty, setNewTopicDifficulty] =
    useState<ExperienceLevel>("intermediate");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddTopic = () => {
    if (!newTopicName.trim()) return;
    setTopics((prev) => [
      ...prev,
      {
        topic_name: newTopicName.trim(),
        difficulty: newTopicDifficulty,
        is_active: true,
      },
    ]);
    setNewTopicName("");
  };

  const handleRemoveTopic = (index: number) => {
    setTopics((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topics.length === 0) {
      setError("Add at least one topic so we can personalize your practice.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: UpsertProfileRequest = {
      display_name: displayName,
      domain,
      experience_level: experienceLevel,
      learning_goal: learningGoal,
      preferred_duration: 90,
      user_type: userType,
      topics,
      ...(userType === "student"
        ? {
            college_year: collegeYear,
            institution_name: institutionName,
            major_degree: majorDegree,
          }
        : {
            years_of_experience: Number(yearsOfExperience),
            current_role: currentRole,
            target_role: targetRole,
          }),
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl relative my-8 text-zinc-100">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              ⚙️ Learner Profile & AI Context
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Customize your persona and topics. The Question Generation Agent calibrates its questions directly to these settings.
            </p>
          </div>
          {canClose && (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-zinc-800 transition"
              aria-label="Close profile editor"
            >
              ✕
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Persona Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">
              Persona Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUserType("student")}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                  userType === "student"
                    ? "bg-amber-500/10 border-amber-500 text-white"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <span className="text-2xl">🎓</span>
                <div>
                  <div className="text-sm font-bold">Student</div>
                  <div className="text-[11px] text-zinc-400">College & Academics</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUserType("professional")}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                  userType === "professional"
                    ? "bg-violet-500/10 border-violet-500 text-white"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <span className="text-2xl">💼</span>
                <div>
                  <div className="text-sm font-bold">Professional</div>
                  <div className="text-[11px] text-zinc-400">Industry & Career</div>
                </div>
              </button>
            </div>
          </div>

          {/* Basic Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Domain / Specialization
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Conditional Persona Fields */}
          {userType === "student" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  College Year
                </label>
                <select
                  value={collegeYear}
                  onChange={(e) => setCollegeYear(e.target.value as CollegeYear)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="1st_year">1st Year</option>
                  <option value="2nd_year">2nd Year</option>
                  <option value="3rd_year">3rd Year</option>
                  <option value="4th_year">4th Year</option>
                  <option value="postgraduate">Postgraduate</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Major / Degree
                </label>
                <input
                  type="text"
                  value={majorDegree}
                  onChange={(e) => setMajorDegree(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Institution
                </label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g. Stanford University"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Experience (Years)
                </label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={yearsOfExperience}
                  onChange={(e) => setYearsOfExperience(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Current Role
                </label>
                <input
                  type="text"
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  placeholder="e.g. Backend Engineer"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Target Role
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Architect"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
          )}

          {/* Level & Goal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Experience Level
              </label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Learning Goal
              </label>
              <select
                value={learningGoal}
                onChange={(e) => setLearningGoal(e.target.value as LearningGoal)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
              >
                <option value="interview_preparation">Interview Preparation</option>
                <option value="concept_clarity">Concept Clarity</option>
                <option value="communication_practice">Communication Practice</option>
              </select>
            </div>
          </div>

          {/* Custom Topics & Difficulty List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Topics & Difficulty Library ({topics.length})
              </label>
              <span className="text-[11px] text-zinc-400">
                Preserved across question generation cycles
              </span>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {topics.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{t.topic_name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.difficulty === "advanced"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : t.difficulty === "intermediate"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}
                    >
                      {t.difficulty}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTopic(idx)}
                    className="text-zinc-500 hover:text-rose-400 px-2 py-1 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add new topic */}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                placeholder="Add custom topic (e.g. Paxos Consensus)"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
              />
              <select
                value={newTopicDifficulty}
                onChange={(e) =>
                  setNewTopicDifficulty(e.target.value as ExperienceLevel)
                }
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <button
                type="button"
                onClick={handleAddTopic}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            {canClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white text-sm font-semibold transition"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-500/20 transition flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Continue"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
