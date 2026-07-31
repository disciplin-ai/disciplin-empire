"use client";

import Link from "next/link";
import { PLANS } from "@/config/plans";
import { useProfile } from "./ProfileProvider";

export default function MembershipClient(){
  const {profile}=useProfile();
  return <main className="app-chrome-pad mx-auto max-w-5xl px-5 pt-10 text-white sm:px-7">
    <p className="app-label text-emerald-300/70">Membership</p>
    <h1 className="app-title-hero mt-3 max-w-3xl">Carry the workflow for as long as you need it.</h1>
    <p className="app-body-secondary mt-4 max-w-2xl">Prices come from the same configuration shown before signup. Billing is not connected, so no button claims to activate a subscription.</p>
    <div className="mt-8 grid gap-3 lg:grid-cols-3">{PLANS.map((plan)=><section key={plan.id} className={`app-card relative p-5 ${profile?.selectedPlan===plan.id?"border-emerald-300/55 bg-emerald-300/[0.045]":""}`}><p className="app-label">{profile?.selectedPlan===plan.id?"Selected preference":plan.featured?"Most athletes":"Plan"}</p><h2 className="mt-3 text-xl font-semibold">{plan.name}</h2><p className="mt-5 text-3xl font-semibold tracking-[-.035em]">{plan.price}</p><p className="mt-1 text-xs text-white/35">{plan.cadence}</p><p className="mt-5 text-sm leading-6 text-white/[.52]">{plan.summary}</p><ul className="mt-5 space-y-2.5 text-sm text-white/60">{plan.value.map((item)=><li key={item} className="flex gap-2"><span className="text-emerald-300/70">✓</span>{item}</li>)}</ul></section>)}</div>
    <div className="mt-6 rounded-2xl border border-amber-300/15 bg-amber-300/[.035] p-4"><p className="text-sm font-semibold text-white">Activation is not available yet.</p><p className="mt-1 text-xs leading-5 text-white/42">Your preference is retained, but no trial, charge, or entitlement has been created.</p></div>
    <Link href="/dashboard" className="app-button-primary mt-6">Return to Dashboard</Link>
  </main>;
}
