import Image from "next/image";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-8 w-8 shrink-0">
        <Image
          src="/images/logo/logo-icon.svg"
          alt=""
          width={32}
          height={32}
          className="object-contain dark:opacity-90"
          role="presentation"
          quality={100}
        />
      </div>
      <span className="text-lg font-semibold text-dark dark:text-white">
        Kaba
      </span>
    </div>
  );
}
