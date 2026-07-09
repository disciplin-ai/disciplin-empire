export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-300/70">
          Disciplin Legal
        </p>

        <h1 className="text-4xl font-semibold tracking-tight">
          Privacy Policy
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
          This Privacy Policy explains how Disciplin collects, uses, stores, and
          protects user data.
        </p>

        <div className="mt-10 space-y-10 rounded-[28px] border border-white/10 bg-white/[0.02] p-8">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Data We Collect</h2>

            <ul className="space-y-3 text-sm leading-7 text-white/65">
              <li>• Account information, such as email and user ID</li>
              <li>• Training preferences and combat-sport context</li>
              <li>• Uploaded frames, images, and technical notes</li>
              <li>• Sensei chat messages and correction history</li>
              <li>• Fuel, recovery, weight, sleep, and nutrition inputs if provided</li>
              <li>• Consent records and privacy request records</li>
              <li>• Basic usage, security, and device information</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. How We Use Data</h2>

            <ul className="space-y-3 text-sm leading-7 text-white/65">
              <li>• To generate coaching guidance and correction outputs</li>
              <li>• To operate Sensei, Vision, Fuel, and related systems</li>
              <li>• To maintain account access and platform security</li>
              <li>• To improve product reliability and safety</li>
              <li>• To process privacy, deletion, and export requests</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. AI Processing</h2>

            <p className="text-sm leading-7 text-white/65">
              Disciplin may process user-provided training data through AI
              systems to generate informational coaching guidance. AI outputs may
              be incomplete or inaccurate and should not replace qualified
              coaches, medical professionals, or parental supervision.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Sensitive Training Data</h2>

            <p className="text-sm leading-7 text-white/65">
              Users may choose to provide information about injuries, recovery,
              sleep, nutrition, weight, or training limitations. This information
              is used to support training guidance and should not be used as a
              substitute for medical advice.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Youth Athletes</h2>

            <p className="text-sm leading-7 text-white/65">
              Users under 18 should use Disciplin only with parent or guardian
              awareness and qualified adult supervision. Disciplin is not a
              replacement for coaches, parents, medical professionals, or safety
              supervision.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. Your Privacy Rights</h2>

            <p className="text-sm leading-7 text-white/65">
              Depending on your location, you may have rights to access, correct,
              delete, restrict, object to processing, export, or withdraw consent
              for your personal data.
            </p>

            <p className="text-sm leading-7 text-white/65">
              California users may also have rights to know what personal
              information is collected, request deletion, opt out of certain
              sharing, and not be discriminated against for exercising privacy
              rights.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7. Data Retention</h2>

            <p className="text-sm leading-7 text-white/65">
              Disciplin keeps data only as long as necessary to provide the
              platform, maintain safety, comply with legal obligations, resolve
              disputes, and improve service reliability. Users may request
              deletion through the Data & Consent Controls page.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">8. Contact</h2>

            <p className="text-sm leading-7 text-white/65">
              Privacy contact: privacy@disciplin.app
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}