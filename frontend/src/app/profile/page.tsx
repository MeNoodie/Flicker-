"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileModal } from "@/components/ProfileModal";
import { getAccessToken } from "@/lib/auth";
import { ApiError, getProfile, upsertProfile } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";
import type { Profile, UpsertProfileRequest } from "@/types";

export default function ProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialName, setInitialName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const sessionToken = await getAccessToken();
        if (!sessionToken) {
          router.replace("/login");
          return;
        }
        if (!active) return;
        setToken(sessionToken);
        const { data } = await getSupabaseClient().auth.getUser();
        if (data.user && active) {
          setInitialName(data.user.user_metadata?.display_name ?? "");
        }

        if (new URLSearchParams(window.location.search).get("setup") !== "1") {
          try {
            const savedProfile = await getProfile(sessionToken);
            if (!active) return;
            setProfile(savedProfile);
          } catch (profileError) {
            if (profileError instanceof ApiError && profileError.status === 404) {
              window.history.replaceState(null, "", "/profile?setup=1");
            } else {
              throw profileError;
            }
          }
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load your profile.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProfile();
    return () => {
      active = false;
    };
  }, [router]);

  async function saveProfile(updated: UpsertProfileRequest) {
    if (!token) throw new Error("Your session has expired. Please log in again.");
    await upsertProfile(token, updated);
    router.replace("/dashboard");
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050b17] text-slate-300">
        <p className="animate-pulse text-sm">Loading your profile…</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050b17] px-5 text-white">
        <section className="max-w-md rounded-2xl border border-rose-300/20 bg-[#0b1425] p-7">
          <h1 className="text-lg font-bold">Couldn&apos;t open your profile</h1>
          <p role="alert" className="mt-2 text-sm leading-6 text-rose-200">{error}</p>
          <button onClick={() => router.refresh()} className="mt-5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold">Try again</button>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b17]">
      <div className="app-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <ProfileModal
          isOpen
          profile={profile}
          initialName={initialName}
          canClose={Boolean(profile)}
          onClose={() => router.replace("/dashboard")}
          onSave={saveProfile}
        />
      </div>
    </main>
  );
}
