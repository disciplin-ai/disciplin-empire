export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-10">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-300/70">
            Disciplin Legal
          </p>

          <h1 className="text-4xl font-semibold tracking-tight">
            Terms & Conditions
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
            These Terms govern access to and use of Disciplin, including
            Sensei, Vision, Fuel, and related training systems.
          </p>
        </div>

        <div className="space-y-10 rounded-[28px] border border-white/10 bg-white/[0.02] p-8">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              1. Informational Training Platform
            </h2>

            <p className="text-sm leading-7 text-white/65">
              Disciplin provides informational coaching support, correction
              systems, training structure guidance, and performance analysis
              tools for combat sports and athletic development.
            </p>

            <p className="text-sm leading-7 text-white/65">
              Disciplin is not a medical provider, physiotherapy service,
              rehabilitation provider, emergency response system, or licensed
              healthcare platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              2. Combat Sports Risk
            </h2>

            <p className="text-sm leading-7 text-white/65">
              Combat sports and athletic training involve inherent physical
              risks, including serious injury, permanent disability, and death.
            </p>

            <p className="text-sm leading-7 text-white/65">
              You accept full responsibility for your training decisions,
              sparring intensity, coaching environment, and physical safety.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              3. Age Requirements
            </h2>

            <p className="text-sm leading-7 text-white/65">
              You must be at least 13 years old to use Disciplin.
            </p>

            <p className="text-sm leading-7 text-white/65">
              If you are under 18, you confirm that a parent or legal guardian
              has reviewed and agreed to these Terms on your behalf.
            </p>

            <p className="text-sm leading-7 text-white/65">
              Minors should train only under qualified adult supervision.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              4. No Medical Advice
            </h2>

            <p className="text-sm leading-7 text-white/65">
              Disciplin does not provide medical advice, concussion diagnosis,
              injury diagnosis, return-to-play clearance, rehabilitation
              protocols, emergency guidance, or treatment recommendations.
            </p>

            <p className="text-sm leading-7 text-white/65">
              Always consult qualified medical professionals regarding injuries,
              pain, dizziness, concussions, weight cutting, dehydration, or
              physical symptoms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              5. Limitation of Liability
            </h2>

            <p className="text-sm leading-7 text-white/65">
              To the maximum extent permitted by law, Disciplin and its
              operators are not liable for injuries, losses, damages, training
              outcomes, or decisions resulting from platform use.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              6. Platform Changes
            </h2>

            <p className="text-sm leading-7 text-white/65">
              Disciplin may modify, suspend, or remove platform features at any
              time without notice.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}