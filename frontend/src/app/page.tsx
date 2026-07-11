export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">TaskFlow Pro</h1>
      <p className="text-lg text-gray-600 mb-8">
        Team Task &amp; Project Management Platform
      </p>
      <div className="flex gap-4">
        <a
          href="/login"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Sign In
        </a>
        <a
          href="/register"
          className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50"
        >
          Register
        </a>
      </div>
    </main>
  );
}