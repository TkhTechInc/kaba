"use client";

import Link from "next/link";
import { useState } from "react";
import SigninWithPhone from "../SigninWithPhone";
import SigninWithPassword from "../SigninWithPassword";
import GoogleSigninButton from "../GoogleSigninButton";
import FacebookSigninButton from "../FacebookSigninButton";

type Tab = "phone" | "email";

export default function Signin() {
  const [tab, setTab] = useState<Tab>("phone");

  return (
    <>
      <div className="mb-4 flex gap-2 rounded-lg border border-stroke p-1 dark:border-dark-3">
        <button
          type="button"
          onClick={() => setTab("phone")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === "phone"
              ? "bg-primary text-white"
              : "text-dark-4 hover:bg-gray-2 dark:text-dark-6 dark:hover:bg-dark-2"
          }`}
        >
          Phone + OTP
        </button>
        <button
          type="button"
          onClick={() => setTab("email")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === "email"
              ? "bg-primary text-white"
              : "text-dark-4 hover:bg-gray-2 dark:text-dark-6 dark:hover:bg-dark-2"
          }`}
        >
          Email + Password
        </button>
      </div>

      {tab === "phone" && <SigninWithPhone />}
      {tab === "email" && <SigninWithPassword />}

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-stroke dark:bg-dark-3" />
        <span className="text-body-sm text-dark-4 dark:text-dark-6">
          or continue with
        </span>
        <div className="h-px flex-1 bg-stroke dark:bg-dark-3" />
      </div>

      <div className="flex flex-col gap-3">
        <GoogleSigninButton text="Sign in" />
        <FacebookSigninButton text="Sign in" />
      </div>

      <div className="mt-6 text-center">
        <p>
          Don&apos;t have an account?{" "}
          <Link href="/auth/sign-up" className="text-primary">
            Sign Up
          </Link>
        </p>
      </div>
    </>
  );
}
