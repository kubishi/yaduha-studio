"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const { authenticated, user, loading, logout } = useAuth();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-bold text-gray-900">
              Yaduha Studio
            </Link>
            <Link
              href="/repos"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Projects
            </Link>
          </div>
          <div>
            {loading ? null : authenticated ? (
              <div className="flex items-center gap-4">
                <Link
                  href="/account"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {user}
                </Link>
                <button
                  onClick={logout}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Logout
                </button>
              </div>
            ) : (
              <a
                href="/api/auth/login"
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
              >
                Login with GitHub
              </a>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
