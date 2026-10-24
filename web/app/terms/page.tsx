export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Terms of Use</h1>
      <div className="prose prose-sm text-slate-700 space-y-4">
        <p>
          PublikEye provides access to publicly available government transparency data. All information displayed
          is sourced from official public records and is made available for informational purposes only.
        </p>
        <h2 className="text-xl font-semibold mt-6">Disclaimer</h2>
        <p>
          PublikEye does not store, modify, or claim ownership of the data. We aggregate and present publicly
          available information to promote transparency and accountability. Users are responsible for verifying
          information accuracy through official government sources.
        </p>
        <h2 className="text-xl font-semibold mt-6">Privacy</h2>
        <p>
          We respect user privacy and do not collect personal information beyond what is necessary for authentication.
          No personal data is sold or shared with third parties.
        </p>
        <h2 className="text-xl font-semibold mt-6">Acceptable Use</h2>
        <p>
          Users agree not to use PublikEye for malicious purposes, automated scraping, or any activity that violates
          applicable laws. Unauthorized access attempts will be logged and may result in legal action.
        </p>
      </div>
    </div>
  );
}
