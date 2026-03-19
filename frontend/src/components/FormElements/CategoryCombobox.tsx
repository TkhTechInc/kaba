"use client";

import { ChevronUpIcon } from "@/assets/icons";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useRef, useState } from "react";

const CATEGORY_OPTIONS = [
  "Sales",
  "Services",
  "Supplies",
  "Transport",
  "Utilities",
  "Salaries",
  "Marketing",
  "Rent",
  "Food",
  "Refunds",
  "Mobile Money",
  "Other",
];

type CategoryComboboxProps = {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

export function CategoryCombobox({
  id,
  name,
  value,
  onChange,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const filtered =
    search.trim().length > 0
      ? CATEGORY_OPTIONS.filter((c) =>
          c.toLowerCase().includes(search.toLowerCase())
        )
      : CATEGORY_OPTIONS;

  const handleSelect = (cat: string) => {
    onChange(cat);
    setSearch("");
    setOpen(false);
  };

  const handleFocus = () => {
    setSearch(value);
    setOpen(true);
  };

  const displayValue = open ? search : value;

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        name={name}
        type="text"
        value={displayValue}
        onChange={(e) => {
          const v = e.target.value;
          setSearch(v);
          if (!open) setOpen(true);
          onChange(v);
        }}
        onFocus={handleFocus}
        onBlur={() => {
          // Delay close so click on option can register
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        role="combobox"
        className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 pr-10 outline-none transition placeholder:text-dark-6 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary dark:focus-visible:ring-primary dark:focus-visible:ring-offset-dark-2"
      />
      <ChevronUpIcon
        aria-hidden
        className={`pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-dark-5 transition-transform dark:text-dark-6 ${open ? "rotate-0" : "rotate-180"}`}
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-stroke bg-white py-1 shadow-lg dark:border-dark-3 dark:bg-gray-dark"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-dark-6">
              {search ? "No matches" : "No categories"}
            </li>
          ) : (
            filtered.map((cat) => (
              <li
                key={cat}
                role="option"
                aria-selected={value === cat}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(cat);
                }}
                className={`cursor-pointer px-4 py-2.5 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-dark-2 ${
                  value === cat ? "bg-primary/10 font-medium text-primary" : "text-dark dark:text-white"
                }`}
              >
                {cat}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
