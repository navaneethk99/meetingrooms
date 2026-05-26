"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { loginAction } from "./actions/auth";

export default function LoginPage() {
  const [serverError, formAction, isPending] = useActionState(
    loginAction,
    null
  );
  const [showPassword, setShowPassword] = useState(false);
  const [clientErrors, setClientErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  function handleFormAction(formData: FormData) {
    const email = (formData.get("email") as string | null)?.trim() ?? "";
    const password = (formData.get("password") as string | null) ?? "";

    const errs: { email?: string; password?: string } = {};
    if (!email) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Enter a valid email address.";
    }
    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < 6) {
      errs.password = "Password must be at least 6 characters.";
    }

    if (Object.keys(errs).length > 0) {
      setClientErrors(errs);
      return;
    }

    setClientErrors({});
    formAction(formData);
  }

  const inputBase =
    "field w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-150";

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Image
          src="/Delhi_Metro_full_logo.svg"
          alt="Logo"
          width={150}
          height={150}
          className="absolute top-5 left-5"
        />
        <div className="text-center mb-2">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Sign in
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
          {/* Server-side auth error */}
          {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {serverError}
            </div>
          )}

          <form
            className="flex flex-col gap-5"
            action={handleFormAction}
            noValidate
          >
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-email"
                className="text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                className={inputBase}
                placeholder="you@company.com"
                autoComplete="email"
                aria-describedby={
                  clientErrors.email ? "email-error" : undefined
                }
                aria-invalid={!!clientErrors.email}
              />
              {clientErrors.email && (
                <p
                  id="email-error"
                  className="text-xs text-red-600 mt-0.5"
                  role="alert"
                >
                  {clientErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="text-sm font-medium text-gray-700"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className={`${inputBase} pr-10`}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-describedby={
                    clientErrors.password ? "password-error" : undefined
                  }
                  aria-invalid={!!clientErrors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {clientErrors.password && (
                <p
                  id="password-error"
                  className="text-xs text-red-600 mt-0.5"
                  role="alert"
                >
                  {clientErrors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="flex w-full justify-center items-center">
              <button
                id="login-submit"
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
                className="w-[60%] py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold
                         hover:bg-blue-700 active:bg-blue-800
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-150 cursor-pointer"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      aria-hidden="true"
                      className="w-4 h-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                      />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
