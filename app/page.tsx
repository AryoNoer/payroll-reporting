import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-zinc-100 to-white dark:from-zinc-900 dark:to-black font-sans text-zinc-800 dark:text-zinc-100">
      <main className="flex flex-col items-center text-center space-y-8 px-8 py-16 rounded-2xl shadow-lg bg-white/70 backdrop-blur-md dark:bg-zinc-900/70">
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-semibold">Halo</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Yuk login dulu untuk melanjutkan ke dashboard kamu.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-white font-medium shadow-md hover:bg-blue-700 active:scale-95 transition-transform duration-150"
        >
          Login
        </Link>
      </main>
    </div>
  );
}
