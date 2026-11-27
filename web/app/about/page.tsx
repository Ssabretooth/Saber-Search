export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:py-20">

      {/* Origin */}
      <div className="mb-14">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-600">Origin</p>
        <h1 className="mb-6 font-serif text-3xl font-light leading-snug tracking-tight text-slate-900 sm:text-4xl">
          On the Obligation of Transparency in a Constitutional Democracy
        </h1>
        <p className="text-sm leading-relaxed text-slate-500 italic">
          A statement by Lucky Sandleni, founder of PublikEye
        </p>
      </div>

      <div className="space-y-7 text-[15px] leading-[1.85] text-slate-700">

        <p>
          Democracies do not fail in a single dramatic moment. They erode — quietly, incrementally —
          through the accumulation of small concealments, of disclosures made in formats no ordinary
          citizen can navigate, of connections that exist in the public record yet remain, in
          practical terms, invisible. PublikEye was built from the conviction that this erosion is
          not inevitable. It is a design failure. And design failures can be corrected.
        </p>

        <p>
          I created this platform because I believe that the duty of transparency imposed upon those
          who hold public office does not end with the act of disclosure. A member of parliament who
          files a register of interests in a scanned PDF, buried within a gazette that the average
          South African has no reason to know exists, has satisfied the letter of the law while
          defeating its spirit entirely. Transparency is not an event. It is a condition — one that
          must be actively maintained, actively made legible, and actively made findable.
        </p>

        <p>
          The South African Constitution is not ambiguous on this point. Section 32 establishes
          the right of access to information held by the state. Section 195 demands that public
          administration be governed by principles of transparency and accountability. These are not
          aspirational clauses. They are enforceable obligations. PublikEye is, in its essence, an
          instrument for holding those obligations to account — not through litigation, but through
          light.
        </p>

        <p>
          Every dataset on this platform originates from official sources. We do not fabricate.
          We do not speculate. We aggregate, structure, and surface what the state has already
          conceded must be public. If a connection between a declared interest and a government
          contract appears here, it appears because both the declaration and the contract are
          matters of public record. The platform adds nothing except the architecture to find them
          together — which is, often, everything.
        </p>

        <p>
          I offer this work not as an act of opposition, but as an act of faith in the republic.
          The institutions of South African democracy are, on balance, ones worth defending. The
          people who serve within them are, in the majority, people of good faith. It is precisely
          because I hold that view that I believe scrutiny is not a threat to good governance — it
          is its precondition. Those with nothing to hide have nothing to fear from a platform that
          shows only what they have already declared.
        </p>

        <blockquote className="border-l-2 border-teal-500 pl-5 text-slate-500 italic">
          The price of accountability is discomfort. The price of its absence is something far
          greater.
        </blockquote>

        <p>
          PublikEye was founded in October 2026 in South Africa. It is independently operated.
          It accepts no funding from political parties, government entities, or organisations with
          a material interest in the data it surfaces. Its only obligation is to the accuracy of
          the public record and to the citizens who are entitled to read it.
        </p>

      </div>

      {/* Divider */}
      <div className="my-14 h-px bg-stone-200" />

      {/* Data sources */}
      <div className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Data Sources</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          {[
            "Parliament of South Africa — Register of Members' Interests",
            "Government Gazette — official proclamations and notices",
            "National Treasury — procurement awards and expenditure data",
            "SAFLII — judicial records and constitutional court decisions",
            "Parliamentary Monitoring Group (PMG) — committee and Hansard archives",
          ].map((src) => (
            <li key={src} className="flex items-start gap-3">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-500" />
              <span>{src}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Contact */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Contact</h2>
        <p className="text-sm text-slate-600">
          Data corrections, press enquiries, or correspondence:{" "}
          <a href="mailto:transparency@publikeye.org" className="font-medium text-teal-600 hover:underline">
            transparency@publikeye.org
          </a>
        </p>
      </div>

    </div>
  );
}
