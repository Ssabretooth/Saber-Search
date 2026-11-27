export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:py-20">

      <div className="mb-14">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-600">Legal</p>
        <h1 className="mb-4 font-serif text-3xl font-light leading-snug tracking-tight text-slate-900 sm:text-4xl">
          Terms of Use
        </h1>
        <p className="text-sm italic text-slate-500">
          Effective from October 2026. These terms govern access to and use of PublikEye.
        </p>
      </div>

      <div className="space-y-10 text-[15px] leading-[1.85] text-slate-700">

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Nature of the Platform</h2>
          <p>
            PublikEye is a public interest transparency platform. It aggregates, structures, and
            presents information drawn exclusively from official government sources: the Register of
            Members' Interests, the Government Gazette, National Treasury procurement records, and
            related statutory publications. No information displayed on this platform originates
            from PublikEye. We are, in the precise legal sense, a medium of access, not a source
            of content.
          </p>
          <p className="mt-4">
            The act of surfacing public information is itself protected conduct under Section 32 of
            the Constitution of the Republic of South Africa, 1996, which guarantees every person
            the right of access to information held by the state. PublikEye operates in direct
            service of that right.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Accuracy and Verification</h2>
          <p>
            While every reasonable measure is taken to ensure the accuracy and currency of the
            information presented, PublikEye does not warrant the completeness or correctness of
            any data displayed. Official government sources are the authoritative record. Users who
            intend to act on information found here, whether in a journalistic, legal, academic,
            or civic capacity, are encouraged to verify directly against the primary source, to
            which every material figure on this platform carries a link.
          </p>
          <p className="mt-4">
            Errors, discrepancies, or outdated information may be reported to{" "}
            <a href="mailto:transparency@publikeye.org" className="font-medium text-teal-600 hover:underline">
              transparency@publikeye.org
            </a>
            . We review and correct promptly.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Permitted Use</h2>
          <p>
            PublikEye is offered for personal, journalistic, academic, and civic use. Users may
            read, cite, and reference the information presented here, provided that any publication
            credits the original official source rather than PublikEye as the origin of the data.
            This platform is a directory, not an authority.
          </p>
          <p className="mt-4">
            Automated scraping, systematic harvesting of data for commercial resale, or any use
            that places undue technical burden on the platform is prohibited. Use that is designed
            to harass, defame, or misrepresent individuals, by selectively citing or
            decontextualising information displayed here, violates both these terms and the spirit
            of the platform's purpose.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Privacy</h2>
          <p>
            PublikEye collects only the information necessary to provide authenticated access: an
            email address and, where a user chooses to supply them, a name. No personal data is
            sold, licensed, or disclosed to any third party for commercial purposes. Authentication
            is handled through industry-standard secure protocols. Users may request deletion of
            their account and associated data at any time by writing to us.
          </p>
          <p className="mt-4">
            The information displayed about public officials on this platform, including their declared
            interests, committee memberships, and connections to procurement records, constitutes
            information about the exercise of public power. It is not private information within
            the meaning of the Protection of Personal Information Act, 2013. Its publication is
            lawful, necessary, and proportionate to the legitimate aim of democratic accountability.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Limitation of Liability</h2>
          <p>
            PublikEye is provided in good faith, without warranty of any kind. We accept no
            liability for decisions made in reliance on information displayed here, nor for any
            interruption to the availability of the platform. The platform is offered as a civic
            resource, not a professional service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Governing Law</h2>
          <p>
            These terms are governed by the laws of the Republic of South Africa. Any dispute
            arising from use of the platform shall be subject to the jurisdiction of the courts of
            South Africa.
          </p>
        </section>

      </div>

      <div className="mt-14 h-px bg-stone-200" />
      <p className="mt-6 text-xs text-slate-400">
        PublikEye is independently operated. For enquiries:{" "}
        <a href="mailto:transparency@publikeye.org" className="text-teal-600 hover:underline">
          transparency@publikeye.org
        </a>
      </p>
    </div>
  );
}
