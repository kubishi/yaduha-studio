export default function LoginPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Sign in to Yaduha Studio
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Connect your GitHub account to browse and edit language packages.
        </p>
        <a
          href="/api/auth/login"
          className="inline-block rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700"
        >
          Login with GitHub
        </a>
      </div>
    </div>
  );
}
