import SignUpForm from "@/components/Auth/SignUpForm";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignUpPage() {
  return (
    <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
      <div className="mb-8 flex flex-col items-center gap-4">
        <Link href="/" className="flex items-center justify-center">
          <Logo />
        </Link>
        <h1 className="text-xl font-bold text-dark dark:text-white">
          Create your account
        </h1>
        <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
          Enter your email and password to get started
        </p>
      </div>

      <SignUpForm />

      <div className="mt-6 text-center">
        <p>
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="text-primary">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
