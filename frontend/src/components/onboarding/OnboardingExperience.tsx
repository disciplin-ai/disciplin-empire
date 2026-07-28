"use client";

import React, { useEffect, useReducer, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { FighterProfile } from "@/components/ProfileProvider";
import { useProfile } from "@/components/ProfileProvider";
import { useWorkflow } from "@/components/WorkflowProvider";
import { PLANS, planById } from "@/config/plans";
import {
  ONBOARDING_STEPS,
  ONBOARDING_VERSION,
  onboardingProgress,
  onboardingReducer,
  resumeStep,
  validateStep,
  type OnboardingStep,
} from "@/lib/onboarding/contracts";
import { authorityViewFor } from "@/lib/authority/state";

const DISCIPLINES = ["MMA", "Wrestling", "BJJ", "Boxing", "Kickboxing", "Muay Thai", "Judo", "Sambo"];
const PREPARATION_PRIORITIES = ["Nutrition", "Hydration", "Recovery", "Weight direction"];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Option({ selected, title, detail, onClick, disabled = false }: { selected: boolean; title: string; detail?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "group min-h-14 w-full rounded-[14px] border px-4 py-3 text-left transition duration-150 ease-app focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[.99]",
        selected ? "border-emerald-300/55 bg-emerald-300/[0.09] shadow-[inset_0_0_0_1px_rgba(110,231,183,.08)]" : "border-white/[0.08] bg-white/[0.025] hover:border-white/16 hover:bg-white/[0.045]"
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-white"><span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full transition",selected?"bg-emerald-300":"bg-white/15 group-hover:bg-white/30")}/>{title}</span>
      {detail ? <span className="mt-1.5 block pl-3.5 text-xs leading-5 text-white/45">{detail}</span> : null}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-white/68">{label}</span>
      {hint ? <span className="ml-2 text-[11px] text-white/32">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

const inputClass = "app-input";

function StageTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div>
      <p className="app-label text-emerald-200/70">{eyebrow}</p>
      <h1 tabIndex={-1} data-stage-heading className="mt-2.5 max-w-2xl app-title-hero outline-none">{title}</h1>
      <p className="mt-3 max-w-xl app-body-secondary sm:text-[15px]">{detail}</p>
    </div>
  );
}

function stageLabel(step: OnboardingStep) {
  const labels: Record<OnboardingStep, string> = {
    ROLE: "Role", ATHLETE_IDENTITY: "Identity", DISCIPLINES: "Disciplines", EXPERIENCE: "Experience",
    COACH_RELATIONSHIP: "Coach", COMPETITION_CONTEXT: "Competition", PREPARATION_CONTEXT: "Preparation",
    PROFILE_REVIEW: "Review", PLAN_SELECTION: "Plan", PERSONALIZING: "Setup", DASHBOARD_READY: "Ready",
  };
  return labels[step];
}

function StageBody({ step, draft, patch, goTo }: { step: OnboardingStep; draft: FighterProfile; patch: (patch: Partial<FighterProfile>) => void; goTo: (step: OnboardingStep) => void }) {
  if (step === "ROLE") {
    return <div className="space-y-5"><StageTitle eyebrow="Your place in Disciplin" title="Who are we setting up?" detail="Athlete onboarding is available now. Coach and organization workspaces remain clearly unavailable until their authority models are complete." />
      <div className="grid gap-2 sm:grid-cols-3">
        <Option selected={draft.role === "athlete"} title="Athlete" detail="Build your personal training workspace." onClick={() => patch({ role: "athlete" })} />
        <Option selected={draft.role === "coach"} title="Coach" detail="Interest only — workflow not yet available." onClick={() => patch({ role: "coach" })} />
        <Option selected={draft.role === "organization"} title="Organization" detail="Interest only — workflow not yet available." onClick={() => patch({ role: "organization" })} />
      </div>
      {draft.role && draft.role !== "athlete" ? <p className="border-l-2 border-amber-300/60 pl-4 text-sm leading-6 text-amber-100/70">This role is not being simulated. Choose Athlete to continue, or return when the supported role launches.</p> : null}
    </div>;
  }

  if (step === "ATHLETE_IDENTITY") {
    return <div className="space-y-6"><StageTitle eyebrow="Athlete profile" title="Make the workspace yours." detail="We use your preferred name throughout the app. Age is collected only to support future safeguarding rules." />
      <div className="grid gap-5 sm:grid-cols-[1fr_160px]">
        <Field label="Preferred name"><input autoFocus autoComplete="name" value={draft.name || ""} onChange={(e) => patch({ name: e.target.value })} className={inputClass} /></Field>
        <Field label="Age" hint="Safeguarding"><input type="number" inputMode="numeric" min={13} max={100} autoComplete="bday-year" value={draft.age || ""} onChange={(e) => patch({ age: e.target.value })} className={inputClass} /></Field>
      </div>
    </div>;
  }

  if (step === "DISCIPLINES") {
    return <div className="space-y-6"><StageTitle eyebrow="Training context" title="What shapes your game?" detail="Your primary discipline anchors language and context. Add secondary disciplines only when they genuinely affect training." />
      <div>
        <p className="text-xs font-bold text-white/65">Primary discipline</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{DISCIPLINES.map((item) => <Option key={item} selected={draft.baseArt === item} title={item} onClick={() => patch({ baseArt: item, secondaryArts: (draft.secondaryArts || []).filter((x) => x !== item) })} />)}</div>
      </div>
      <div><p className="text-xs font-bold text-white/65">Secondary disciplines <span className="font-normal text-white/30">optional</span></p>
        <div className="mt-3 flex flex-wrap gap-2">{DISCIPLINES.filter((x) => x !== draft.baseArt).map((item) => { const selected=(draft.secondaryArts||[]).includes(item); return <button type="button" key={item} aria-pressed={selected} onClick={() => patch({ secondaryArts: selected ? (draft.secondaryArts||[]).filter((x)=>x!==item) : [...(draft.secondaryArts||[]),item] })} className={cn("min-h-11 rounded-full border px-4 text-sm font-bold focus-visible:ring-2 focus-visible:ring-emerald-300",selected?"border-emerald-300/55 bg-emerald-300/12 text-emerald-100":"border-white/10 bg-white/[0.025] text-white/52")}>{item}</button>; })}</div>
      </div>
    </div>;
  }

  if (step === "EXPERIENCE") {
    return <div className="space-y-6"><StageTitle eyebrow="Experience" title="Set the right level of context." detail="This changes vocabulary and assumptions. It does not rank your ability or authorize training." />
      <div className="grid gap-2 sm:grid-cols-2">{[
        ["Beginner","Building fundamentals"],["Intermediate","Training consistently"],["Advanced","Experienced competitive athlete"],["Professional","Professional competition context"],
      ].map(([title,detail]) => <Option key={title} selected={draft.competitionLevel===title} title={title} detail={detail} onClick={()=>patch({competitionLevel:title,yearsTraining:title})}/>)}</div>
      <div><p className="text-xs font-bold text-white/65">Training frequency</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{["1–2 sessions / week","3–4 sessions / week","5+ sessions / week"].map((item)=><Option key={item} selected={draft.trainingFrequency===item} title={item} onClick={()=>patch({trainingFrequency:item})}/>)}</div></div>
    </div>;
  }

  if (step === "COACH_RELATIONSHIP") {
    const hasCoach=draft.coachRelationship==="coach_connected";
    return <div className="space-y-6"><StageTitle eyebrow="Coaching authority" title="Who sets the correction?" detail="Disciplin preserves the difference between coach instruction and athlete-directed work." />
      <div className="grid gap-2">{[
        ["coach_connected","I have a coach.","Coach guidance can be recorded and submitted for confirmation."],
        ["athlete_directed","I do not have a coach.","Your work remains athlete directed and is clearly labelled Not coach approved."],
      ].map(([value,title,detail])=><Option key={value} selected={draft.coachRelationship===value} title={title} detail={detail} onClick={()=>patch({coachRelationship:value as FighterProfile["coachRelationship"]})}/>)}</div>
      <AnimatePresence initial={false}>{hasCoach ? <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} className="overflow-hidden"><div className="grid gap-5 border-l-2 border-emerald-300/30 pl-4 sm:grid-cols-2">
        <Field label="Coach name" hint="optional"><input autoComplete="name" value={draft.coachName||""} onChange={(e)=>patch({coachName:e.target.value})} className={inputClass}/></Field>
        <Field label="Gym or academy" hint="optional"><input autoComplete="organization" value={draft.gym||""} onChange={(e)=>patch({gym:e.target.value})} className={inputClass}/></Field>
        <div className="sm:col-span-2"><p className="text-xs font-bold text-white/65">How corrections will be recorded</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{[
          ["coach_records","Coach records them"],["athlete_records_exact_words","I record exact words"],["review_together","We review together"],
        ].map(([value,title])=><Option key={value} selected={draft.correctionRecordingMethod===value} title={title} onClick={()=>patch({correctionRecordingMethod:value as FighterProfile["correctionRecordingMethod"]})}/>)}</div></div>
      </div></motion.div>:null}</AnimatePresence>
    </div>;
  }

  if (step === "COMPETITION_CONTEXT") {
    const scheduled=draft.competitionStatus==="fight_camp"||draft.competitionStatus==="scheduled";
    return <div className="space-y-6"><StageTitle eyebrow="Competition" title="What is training pointing toward?" detail="Competition and weight context appear only when they are relevant and sourced truthfully." />
      <div className="grid gap-2 sm:grid-cols-3">{[
        ["fight_camp","Currently in fight camp"],["scheduled","Competition scheduled"],["none","No competition scheduled"],
      ].map(([value,title])=><Option key={value} selected={draft.competitionStatus===value} title={title} onClick={()=>patch({competitionStatus:value,currentPhase:value==="fight_camp"?"Fight camp":value==="scheduled"?"Competition scheduled":"General training",fightDate:value==="none"?undefined:draft.fightDate})}/>)}</div>
      <AnimatePresence initial={false}>{scheduled?<motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} className="overflow-hidden"><div className="grid gap-5 border-l-2 border-cyan-200/25 pl-4 sm:grid-cols-2">
        <Field label="Approximate event date" hint="optional"><input type="date" value={draft.fightDate||""} onChange={(e)=>patch({fightDate:e.target.value})} className={inputClass}/></Field>
        <Field label="Weight class or target" hint="optional"><input value={draft.weightClass||""} onChange={(e)=>patch({weightClass:e.target.value})} className={inputClass}/></Field>
        {draft.weightClass?<div className="sm:col-span-2"><p className="text-xs font-bold text-white/65">Source of the target</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{[["athlete","Athlete"],["coach","Coach"],["qualified_practitioner","Qualified practitioner"]].map(([value,title])=><Option key={value} selected={draft.targetSource===value} title={title} onClick={()=>patch({targetSource:value as FighterProfile["targetSource"]})}/>)}</div></div>:null}
      </div></motion.div>:null}</AnimatePresence>
    </div>;
  }

  if (step === "PREPARATION_CONTEXT") {
    return <div className="space-y-6"><StageTitle eyebrow="Preparation" title="Set the boundaries around the work." detail="Fuel may narrow preparation conditions. It never selects or replaces the correction." />
      <div><p className="text-xs font-bold text-white/65">Nutrition support</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{[
        ["qualified_practitioner","Qualified practitioner"],["coach_guidance","Coach guidance"],["self_guided","Self-guided"],
      ].map(([value,title])=><Option key={value} selected={draft.nutritionSupport===value} title={title} onClick={()=>patch({nutritionSupport:value as FighterProfile["nutritionSupport"]})}/>)}</div></div>
      <div><p className="text-xs font-semibold text-white/65">Current priorities <span className="font-normal text-white/30">optional</span></p><div className="mt-3 flex flex-wrap gap-2">{PREPARATION_PRIORITIES.map((item)=>{const selected=(draft.preparationPriorities||[]).includes(item);return <button type="button" key={item} aria-pressed={selected} onClick={()=>patch({preparationPriorities:selected?(draft.preparationPriorities||[]).filter((x)=>x!==item):[...(draft.preparationPriorities||[]),item]})} className={cn("min-h-10 rounded-xl border px-3.5 text-sm font-medium transition duration-150 ease-app focus-visible:ring-2 focus-visible:ring-emerald-300",selected?"border-emerald-300/55 bg-emerald-300/[.1] text-emerald-100":"border-white/10 bg-white/[.02] text-white/[.52] hover:border-white/20 hover:text-white/75")}>{item}</button>})}</div></div>
      <Field label="Existing restrictions" hint="optional"><textarea rows={3} value={draft.hardBoundaries||""} onChange={(e)=>patch({hardBoundaries:e.target.value})} placeholder="Use exact restrictions from you, your coach, or a practitioner." className={cn(inputClass,"py-3")}/></Field>
    </div>;
  }

  if (step === "PROFILE_REVIEW") {
    const authority = authorityViewFor({ coachRelationship: draft.coachRelationship });
    const rows=[
      ["Identity",`${draft.name}, age ${draft.age}`,"ATHLETE_IDENTITY"],["Disciplines",[draft.baseArt,...(draft.secondaryArts||[])].filter(Boolean).join(" · "),"DISCIPLINES"],
      ["Experience",`${draft.competitionLevel} · ${draft.trainingFrequency}`,"EXPERIENCE"],["Authority",draft.coachRelationship==="coach_connected"?`Works with a coach${draft.coachName?`: ${draft.coachName}`:""} · ${authority.dashboard.status}`:authority.fuel.authorityLabel,"COACH_RELATIONSHIP"],
      ["Competition",draft.competitionStatus==="none"?"No competition scheduled":`${draft.currentPhase}${draft.fightDate?` · ${draft.fightDate}`:""}`,"COMPETITION_CONTEXT"],
      ["Preparation",`${draft.nutritionSupport?.replaceAll("_"," ")}${(draft.preparationPriorities||[]).length?` · ${(draft.preparationPriorities||[]).join(", ")}`:""}`,"PREPARATION_CONTEXT"],
    ] as const;
    return <div className="space-y-6"><StageTitle eyebrow="Profile review" title={`This is ${draft.name || "your"}’s operating context.`} detail="Review the facts that will shape the workspace. No correction or coach approval has been invented." />
      <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">{rows.map(([label,value,target])=><button type="button" key={label} onClick={()=>goTo(target)} className="flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-emerald-300"><span><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/32">{label}</span><span className="mt-1 block text-sm font-semibold text-white/78">{value||"Not set"}</span></span><span className="text-xs font-bold text-emerald-200/55">Edit</span></button>)}</div>
    </div>;
  }

  if (step === "PLAN_SELECTION") {
    return <div className="space-y-6"><StageTitle eyebrow="Transparent plans" title="Your training workspace is ready." detail="Choose what you intend to use. No payment is collected and no subscription or trial is activated because billing is not connected yet." />
      <div className="grid gap-3 lg:grid-cols-3">{PLANS.map((plan)=>{const selected=draft.selectedPlan===plan.id;return <button type="button" key={plan.id} aria-pressed={selected} onClick={()=>patch({selectedPlan:plan.id})} className={cn("relative min-h-48 rounded-[20px] border p-5 text-left transition duration-150 ease-app focus-visible:ring-2 focus-visible:ring-emerald-300",selected?"border-emerald-300/60 bg-emerald-300/[0.08] shadow-[0_16px_50px_rgba(16,185,129,.08)]":"border-white/10 bg-white/[0.025] hover:-translate-y-0.5 hover:border-white/25")}><span className={cn("absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full border",selected?"border-emerald-300 bg-emerald-300 text-[#04110c]":"border-white/15")} aria-hidden="true">{selected?"✓":""}</span><span className="app-label">{plan.featured?"Most athletes":"Plan"}</span><span className="mt-3 block text-xl font-semibold text-white">{plan.name}</span><span className="mt-4 block text-3xl font-semibold tracking-[-.035em] text-white">{plan.price}</span><span className="block text-xs text-white/38">{plan.cadence}</span><span className="mt-4 block text-sm leading-6 text-white/55">{plan.summary}</span></button>})}</div>
      <p className="text-xs leading-5 text-white/35">Selection records preference only. <Link href="/plans" className="font-bold text-emerald-200/70 underline underline-offset-4">Review all plan details</Link></p>
    </div>;
  }

  if (step === "PERSONALIZING") {
    const labels=["Building your athlete profile","Preparing your training workspace","Setting your coaching authority","Configuring Vision, Sensei, and Fuel"];
    return <div className="space-y-8"><StageTitle eyebrow="Personalizing" title={`Preparing ${draft.name || "your"}’s workspace.`} detail="Each check reflects saved profile and deterministic workspace setup—not an arbitrary timer." />
      <div className="space-y-3" aria-live="polite">{labels.map((label,index)=><div key={label} className={cn("flex min-h-12 items-center gap-3 border-l-2 pl-4 transition",index<Number(draft.onboardingSetupCheckpoint||0)?"border-emerald-300 text-white":"border-white/10 text-white/30")}><span className={cn("h-2 w-2 rounded-full",index<Number(draft.onboardingSetupCheckpoint||0)?"bg-emerald-300":"bg-white/15")}/><span className="text-sm font-bold">{label}</span></div>)}</div>
    </div>;
  }

  const plan=planById(draft.selectedPlan);
  return <div className="space-y-6"><StageTitle eyebrow="Dashboard ready" title={`Welcome to Disciplin, ${draft.name || "athlete"}.`} detail={`Your ${plan?.name||"workspace"} preference is recorded. Your first action is based on the coaching relationship you supplied.`} /></div>;
}

type SaveResult = { ok: true } | { ok: false; error: string };

export default function OnboardingExperience({ initialProfile, saveProfileOverride, onCompleteOverride }: { initialProfile: FighterProfile; saveProfileOverride?: (profile: FighterProfile) => Promise<SaveResult>; onCompleteOverride?: () => void }) {
  const router=useRouter();
  const reduceMotion=useReducedMotion();
  const { saveProfile: secureSaveProfile }=useProfile();
  const saveProfile=saveProfileOverride||secureSaveProfile;
  const { reset: resetWorkflow }=useWorkflow();
  const resumed=resumeStep(initialProfile);
  const [state,dispatch]=useReducer(onboardingReducer,{
    step:resumed, phase:resumed==="ROLE"?"READY":"RESUMED", direction:1, error:null,
    draft:{role:"athlete",secondaryArts:[],preparationPriorities:[],...initialProfile}, personalizationIndex:0,
  });
  const autosaveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const personalizationStarted=useRef(false);
  const headingRef=useRef<HTMLDivElement>(null);

  const progress=onboardingProgress(state.step);
  const stepIndex=ONBOARDING_STEPS.indexOf(state.step);
  const canGoBack=stepIndex>0&&state.step!=="PERSONALIZING";

  function patchProfile(patch: Partial<FighterProfile>) {
    const next={...state.draft,...patch,onboardingVersion:ONBOARDING_VERSION,onboardingStage:state.step};
    dispatch({type:"PATCH",patch:{...patch,onboardingVersion:ONBOARDING_VERSION,onboardingStage:state.step}});
    if(autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current=setTimeout(async()=>{
      const result=await saveProfile(next);
      if(!result.ok) dispatch({type:"SAVE_ERROR",error:`Draft not saved: ${result.error}`});
    },650);
  }

  async function persistAndMove(direction: "next"|"back", target?: OnboardingStep) {
    if(direction==="next") {
      const validation=validateStep(state.step,state.draft);
      if(validation){dispatch({type:"SAVE_ERROR",error:validation});return;}
    }
    if(autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const destination=target??ONBOARDING_STEPS[Math.max(0,Math.min(ONBOARDING_STEPS.length-1,stepIndex+(direction==="next"?1:-1)))];
    const nextDraft={...state.draft,onboardingVersion:ONBOARDING_VERSION,onboardingStage:destination};
    dispatch({type:"SAVE_START"});
    const result=await saveProfile(nextDraft);
    if(!result.ok){dispatch({type:"SAVE_ERROR",error:result.error});return;}
    dispatch({type:"PATCH",patch:{onboardingVersion:ONBOARDING_VERSION,onboardingStage:destination}});
    dispatch(target?{type:"GO_TO",step:target}:direction==="next"?{type:"NEXT"}:{type:"BACK"});
  }

  useEffect(()=>{
    const heading=headingRef.current?.querySelector<HTMLElement>("[data-stage-heading]");
    heading?.focus({preventScroll:true});
  },[state.step]);

  useEffect(()=>()=>{if(autosaveTimer.current) clearTimeout(autosaveTimer.current);},[]);

  useEffect(()=>{
    if(state.step!=="PERSONALIZING"||personalizationStarted.current)return;
    personalizationStarted.current=true;
    void (async()=>{
      const base={...state.draft,onboardingStage:"PERSONALIZING",onboardingVersion:ONBOARDING_VERSION,onboardingSetupCheckpoint:0};
      const saved=await saveProfile(base);
      if(!saved.ok){dispatch({type:"SAVE_ERROR",error:saved.error});personalizationStarted.current=false;return;}
      for(let index=0;index<4;index+=1){
        const checkpoint={...base,onboardingSetupCheckpoint:index+1};
        const result=await saveProfile(checkpoint);
        if(!result.ok){dispatch({type:"SAVE_ERROR",error:result.error});personalizationStarted.current=false;return;}
        dispatch({type:"PATCH",patch:{onboardingSetupCheckpoint:index+1}});
        dispatch({type:"PERSONALIZATION_PROGRESS",index:index+1});
      }
      resetWorkflow();
      const complete={...state.draft,onboardingVersion:ONBOARDING_VERSION,onboardingSetupCheckpoint:4,onboardingStage:"DASHBOARD_READY" as const,onboardingCompletedAt:new Date().toISOString(),dashboardRevealPending:true,currentCorrection:undefined};
      const result=await saveProfile(complete);
      if(!result.ok){dispatch({type:"SAVE_ERROR",error:result.error});personalizationStarted.current=false;return;}
      dispatch({type:"COMPLETE"});
      if(onCompleteOverride){onCompleteOverride();return;}
      router.replace("/dashboard?firstRun=1");
      router.refresh();
    })();
  },[state.step,state.draft,saveProfile,resetWorkflow,router,onCompleteOverride]);

  useEffect(()=>{
    if(state.step==="DASHBOARD_READY"&&state.draft.onboardingCompletedAt&&onCompleteOverride){
      onCompleteOverride();
    }
  },[state.step,state.draft.onboardingCompletedAt,onCompleteOverride]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#03070d] px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))] text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(52,211,153,.09),transparent_34%),radial-gradient(circle_at_94%_16%,rgba(59,130,246,.05),transparent_30%)]"/>
      <header className="relative mx-auto flex max-w-4xl items-center justify-between py-2.5">
        <Link href="/" className="text-xs font-bold tracking-[0.24em] text-emerald-200">DISCIPLIN</Link>
        <div className="flex items-center gap-2 text-xs font-medium text-white/42"><span className="text-white/72">{stageLabel(state.step)}</span><span aria-hidden="true">·</span><span>{Math.min(stepIndex+1,9)} of 9</span></div>
      </header>
      <div role="progressbar" aria-label="Onboarding progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="relative mx-auto mt-2 h-0.5 max-w-4xl overflow-hidden rounded-full bg-white/[0.06]"><motion.div className="h-full bg-emerald-300" animate={{width:`${progress}%`}} transition={{duration:reduceMotion?0:.2,ease:[.22,1,.36,1]}}/></div>

      <form onSubmit={(e)=>{e.preventDefault();if(state.step!=="PERSONALIZING")void persistAndMove("next");}} className="relative mx-auto flex min-h-[calc(100dvh-78px)] max-w-4xl flex-col">
        <div ref={headingRef} aria-live="polite" className="flex flex-1 items-center py-6 sm:py-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.section key={state.step} initial={reduceMotion?false:{opacity:0,x:state.direction*16}} animate={{opacity:1,x:0}} exit={reduceMotion?{opacity:0}:{opacity:0,x:state.direction*-12}} transition={{duration:reduceMotion?0:.22,ease:[.22,1,.36,1]}} className="w-full">
              <StageBody step={state.step} draft={state.draft} patch={patchProfile} goTo={(step)=>void persistAndMove("back",step)}/>
            </motion.section>
          </AnimatePresence>
        </div>

        {state.error?<div role="alert" className="mb-4 border-l-2 border-rose-300 bg-rose-300/[0.055] px-4 py-3 text-sm font-semibold text-rose-100">{state.error}<button type="button" onClick={()=>void persistAndMove("next")} className="ml-3 underline underline-offset-4">Retry</button></div>:null}
        {state.phase==="RESUMED"?<p className="mb-3 text-xs font-semibold text-emerald-200/60">Your saved setup has been resumed.</p>:null}
        {state.step!=="PERSONALIZING"&&state.step!=="DASHBOARD_READY"?<footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/[0.07] bg-[#03070d]/92 py-3.5 backdrop-blur-xl">
          <button type="button" disabled={!canGoBack||state.phase==="SAVING"} onClick={()=>void persistAndMove("back")} className="app-button-quiet disabled:opacity-0">Back</button>
          <button type="submit" disabled={state.phase==="SAVING"} aria-busy={state.phase==="SAVING"} className="app-button-primary min-w-40">{state.phase==="SAVING"?"Saving…":state.step==="PLAN_SELECTION"?"Prepare workspace":state.step==="PROFILE_REVIEW"?"Choose a plan":"Continue"}</button>
        </footer>:null}
      </form>
    </main>
  );
}
