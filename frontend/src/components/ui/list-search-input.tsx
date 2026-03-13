"use client";

import { SearchIcon } from "@/assets/icons8";

interface ListSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ListSearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: ListSearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-48 rounded-lg border border-stroke bg-gray-2 py-1.5 pl-8 pr-3 text-sm text-dark placeholder:text-dark-4 focus:border-primary focus:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:placeholder:text-dark-6 sm:w-56"
        aria-label={placeholder}
      />
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dark-4 dark:text-dark-6" />
    </div>
  );
}
