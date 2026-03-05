import Signin from "@/components/Auth/Signin";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignIn() {
  return (
    <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
      <div className="mb-8 flex flex-col items-center gap-4">
        <Link href="/" className="flex justify-center">
          <Logo />
        </Link>
        <h1 className="text-xl font-bold text-dark dark:text-white">
          Sign in to your account
        </h1>
        <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
          Sign in with your phone or email
        </p>
      </div>

      <Suspense fallback={<div className="h-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />}>
        <Signin />
      </Suspense>
    </div>
  );
}
