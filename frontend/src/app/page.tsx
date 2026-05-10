import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent to-accent2" />
            <span className="font-semibold">AI Builder</span>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-muted hover:text-text">
              Sign in
            </Link>
            <Link
              href="/register"
              className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent/90 text-white"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="flex-1 flex items-center">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-tight">
            Build websites & files with{" "}
            <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
              real AI
            </span>
            .
          </h1>
          <p className="mt-6 text-muted text-lg">
            Chat with Claude, generate complete projects, preview them instantly. Your work is saved
            per account, secured with JWT.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-md bg-accent hover:bg-accent/90 text-white font-medium"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-md border border-border hover:bg-panel font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border text-muted text-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span>AI Builder</span>
          <span>Powered by Anthropic Claude</span>
        </div>
      </footer>
    </main>
  );
}
