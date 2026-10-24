export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">About PublikEye</h1>
      <div className="prose prose-sm text-slate-700 space-y-4">
        <p>
          <strong>PublikEye</strong> is a transparency and accountability platform for South Africa.
          We aggregate publicly available government data to help citizens track how state resources
          and public funds are used by members of parliament.
        </p>

        <h2 className="text-xl font-semibold mt-6">Our Mission</h2>
        <p>
          To promote democratic accountability through accessible, comprehensive transparency data.
          We believe citizens have the right to know how their government functions and how public
          resources are allocated.
        </p>

        <h2 className="text-xl font-semibold mt-6">Data Sources</h2>
        <ul className="list-disc list-inside space-y-2 ml-2">
          <li>Official Parliament of South Africa records</li>
          <li>Government Gazette publications</li>
          <li>SAFLII judicial records</li>
          <li>Parliamentary Monitoring Group (PMG) archives</li>
          <li>National Treasury publications</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">Created</h2>
        <p>
          PublikEye was created in <strong>October 2026</strong> in <strong>South Africa</strong> by
          dedicated transparency advocates committed to open government and civic engagement.
        </p>

        <h2 className="text-xl font-semibold mt-6">Contact</h2>
        <p>
          Questions, feedback, or data corrections? Contact us at{' '}
          <strong>transparency@publikeye.org</strong>
        </p>
      </div>
    </div>
  );
}
