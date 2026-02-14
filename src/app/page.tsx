import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="text-center py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Yaduha Studio
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          A development environment for building structured language translation
          packages with the Yaduha framework. Edit code, validate schemas, and
          preview translations — all in the browser.
        </p>
        <Link
          href="/repos"
          className="inline-block rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700"
        >
          Get Started
        </Link>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Code Editor
          </h3>
          <p className="text-sm text-gray-600">
            Edit language package files with Monaco Editor, featuring syntax
            highlighting and Python IntelliSense.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            In-Browser Validation
          </h3>
          <p className="text-sm text-gray-600">
            Validate your language schemas instantly using Pyodide — Python
            running directly in your browser via WebAssembly.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            GitHub Integration
          </h3>
          <p className="text-sm text-gray-600">
            Browse and edit your language package repos directly. Changes sync
            with GitHub so you can collaborate with your team.
          </p>
        </div>
      </section>
    </div>
  );
}
