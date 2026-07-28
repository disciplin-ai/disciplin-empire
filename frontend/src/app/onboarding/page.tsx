"use client";

import { Suspense, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DEVELOPMENT_PREVIEW_UPDATED_EVENT, useProfile, type FighterProfile } from "@/components/ProfileProvider";
import OnboardingExperience from "@/components/onboarding/OnboardingExperience";
import { normalizeCoachRelationship } from "@/lib/onboarding/authority";

const DEV_KEY="disciplin_onboarding_development_preview_v1";
const noopSubscribe=()=>()=>{};

function DevHarness({ fresh = false }: { fresh?: boolean }){
  const router=useRouter();
  const raw=useSyncExternalStore(noopSubscribe,()=>window.sessionStorage.getItem(DEV_KEY)||"",()=>"");
  const initialProfile=useMemo<FighterProfile>(()=>{if(fresh)return{role:"athlete"};try{const parsed=raw?JSON.parse(raw):{role:"athlete"};return{...parsed,coachRelationship:normalizeCoachRelationship(parsed.coachRelationship)};}catch{return{role:"athlete"};}},[raw,fresh]);
  return <OnboardingExperience key={fresh?"development-fresh":raw||"development-empty"} initialProfile={initialProfile} saveProfileOverride={async(next)=>{window.sessionStorage.setItem(DEV_KEY,JSON.stringify(next));return{ok:true};}} onCompleteOverride={()=>{document.cookie="disciplin_onboarding_preview=1; path=/; SameSite=Lax";window.dispatchEvent(new Event(DEVELOPMENT_PREVIEW_UPDATED_EVENT));router.replace("/dashboard?firstRun=1&dev=1");router.refresh();}}/>;
}

function OnboardingPageInner() {
  const params=useSearchParams();
  const { user, profile, loading }=useProfile();
  const devPreview=process.env.NODE_ENV!=="production"&&params.get("dev")==="1";
  if(devPreview)return <DevHarness fresh={params.get("fresh")==="1"}/>;
  if(loading) return <main className="grid min-h-[100dvh] place-items-center bg-[#030811] text-sm text-white/50" aria-busy="true"><div className="flex items-center gap-3"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300"/>Loading your saved setup…</div></main>;
  if(!user) return <main className="grid min-h-[100dvh] place-items-center bg-[#030811] px-5 text-white"><div className="app-card max-w-md p-7 text-center sm:p-8"><p className="app-label text-emerald-300/70">Athlete setup</p><h1 className="app-title-section mt-3">Sign in to continue.</h1><p className="app-body-secondary mt-4">Your onboarding progress is saved to your secure athlete profile.</p><Link href="/auth/login?mode=signup&next=/onboarding" className="app-button-primary mt-6">Create account</Link></div></main>;
  return <OnboardingExperience initialProfile={profile||{role:"athlete"}}/>;
}

export default function OnboardingPage(){return <Suspense fallback={<main className="grid min-h-[100dvh] place-items-center bg-[#030811] text-white/45">Loading…</main>}><OnboardingPageInner/></Suspense>}
