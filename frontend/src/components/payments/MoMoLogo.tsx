"use client";

import Image from "next/image";

/** MTN MoMo logo for payment buttons. */
export function MoMoLogo({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/images/payments/momo-logo.svg"
      alt="MTN MoMo"
      width={100}
      height={28}
      className={className}
      unoptimized
    />
  );
}
