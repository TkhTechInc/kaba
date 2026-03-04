import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-12">
      <div className="mb-8 flex flex-col items-center gap-4">
        <Link href="/">
          <Image
            className="hidden dark:block"
            src={"/images/logo/logo.svg"}
            alt="Kaba"
            width={176}
            height={32}
          />
          <Image
            className="dark:hidden"
            src={"/images/logo/logo-dark.svg"}
            alt="Kaba"
            width={176}
            height={32}
          />
        </Link>
        <h1 className="text-xl font-bold text-dark dark:text-white">
          Forgot password
        </h1>
        <p className="text-center text-body-sm text-dark-4 dark:text-dark-6">
          Password reset is coming soon. Please contact support or sign in with
          another method.
        </p>
      </div>

      <div className="text-center">
        <Link
          href="/auth/sign-in"
          className="inline-block rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
