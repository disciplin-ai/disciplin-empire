import Link from "next/link";
import { PLANS } from "@/config/plans";

export default function PlansPage(){
  return <main className="app-canvas px-5 py-6 sm:px-8"><div className="mx-auto max-w-5xl">
    <header className="app-enter flex h-12 items-center justify-between"><Link href="/" className="app-brand">DISCIPLIN</Link><Link href="/auth/login?mode=signup&next=/onboarding" className="app-button-quiet min-h-9 text-xs">Create account</Link></header>
    <div className="app-enter app-enter-delay mt-14 max-w-3xl"><p className="app-label text-emerald-300/70">Transparent plans</p><h1 className="app-title-display mt-3">Know the price before you begin.</h1><p className="app-body mt-5 max-w-2xl">Choose a preference during onboarding. No payment is collected and no entitlement is activated until production billing is connected.</p></div>
    <div className="mt-9 grid gap-4 lg:grid-cols-3">{PLANS.map((plan)=><section key={plan.id} className={`app-card relative overflow-hidden p-5 ${plan.featured?"border-emerald-200/25":""}`}>{plan.featured?<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/55 to-transparent" aria-hidden="true"/>:null}<p className={`app-label ${plan.featured?"text-emerald-200/70":""}`}>{plan.featured?"Most athletes":"Plan"}</p><h2 className="mt-3 text-xl font-semibold">{plan.name}</h2><p className="mt-5 text-3xl font-semibold tracking-[-.035em]">{plan.price}</p><p className="mt-1 text-xs text-white/35">{plan.cadence}</p><p className="mt-5 min-h-14 text-sm leading-6 text-white/[.52]">{plan.summary}</p><ul className="mt-5 space-y-2.5 text-sm text-white/60">{plan.value.map((item)=><li key={item} className="flex gap-2"><span className="text-emerald-300/70">✓</span>{item}</li>)}</ul></section>)}</div>
    <Link href="/auth/login?mode=signup&next=/onboarding" className="app-button-primary mb-8 mt-8">Create account</Link>
  </div></main>;
}
