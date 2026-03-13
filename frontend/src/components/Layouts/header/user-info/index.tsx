"use client";

import { ChevronUpIcon } from "@/assets/icons";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useAuthOptional } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LogOutIcon, SettingsIcon, UserIcon } from "./icons";

const AVATAR_COLORS = [
  ["#4F46E5", "#EEF2FF"], // indigo
  ["#0891B2", "#ECFEFF"], // cyan
  ["#059669", "#ECFDF5"], // emerald
  ["#D97706", "#FFFBEB"], // amber
  ["#DC2626", "#FEF2F2"], // red
  ["#7C3AED", "#F5F3FF"], // violet
];

function InitialsAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const initial = (name?.[0] ?? "?").toUpperCase();
  const code = name.charCodeAt(0) % AVATAR_COLORS.length;
  const [fg, bg] = AVATAR_COLORS[code];
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
        userSelect: "none",
      }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function UserInfo() {
  const [isOpen, setIsOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const auth = useAuthOptional();

  const displayName =
    auth?.user?.name ??
    auth?.user?.email ??
    auth?.user?.phone ??
    auth?.user?.id ??
    "User";
  const displaySub =
    auth?.user?.name && auth?.user?.email
      ? auth.user.email
      : auth?.user?.phone
        ? `ID: ${auth.user.id}`
        : "";
  const pictureUrl = auth?.user?.picture && !avatarError ? auth.user.picture : null;

  const Avatar = ({ size = 48 }: { size?: number }) =>
    pictureUrl ? (
      <Image
        src={pictureUrl}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        alt={`Avatar of ${displayName}`}
        role="presentation"
        width={size}
        height={size}
        unoptimized
        onError={() => setAvatarError(true)}
      />
    ) : (
      <InitialsAvatar name={displayName} size={size} />
    );

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="rounded align-middle outline-none ring-primary ring-offset-2 focus-visible:ring-1 dark:ring-offset-gray-dark">
        <span className="sr-only">My Account</span>

        <figure className="flex items-center gap-3">
          <Avatar size={48} />
          <figcaption className="flex items-center gap-1 font-medium text-dark dark:text-dark-6 max-[1024px]:sr-only">
            <span>{displayName}</span>

            <ChevronUpIcon
              aria-hidden
              className={cn(
                "rotate-180 transition-transform",
                isOpen && "rotate-0",
              )}
              strokeWidth={1.5}
            />
          </figcaption>
        </figure>
      </DropdownTrigger>

      <DropdownContent
        className="border border-stroke bg-white shadow-md dark:border-dark-3 dark:bg-gray-dark min-[230px]:min-w-[17.5rem]"
        align="end"
      >
        <h2 className="sr-only">User information</h2>

        <figure className="flex items-center gap-2.5 px-5 py-3.5">
          <Avatar size={48} />

          <figcaption className="space-y-1 text-base font-medium">
            <div className="mb-2 leading-none text-dark dark:text-white">
              {displayName}
            </div>

            {displaySub && (
              <div className="leading-none text-gray-6">{displaySub}</div>
            )}
          </figcaption>
        </figure>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6 [&>*]:cursor-pointer">
          <Link
            href={"/profile"}
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
          >
            <UserIcon />

            <span className="mr-auto text-base font-medium">View profile</span>
          </Link>

          <Link
            href={"/settings"}
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
          >
            <SettingsIcon />

            <span className="mr-auto text-base font-medium">
              Account Settings
            </span>
          </Link>
        </div>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6">
          <button
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
            onClick={() => {
              setIsOpen(false);
              auth?.logout?.();
            }}
          >
            <LogOutIcon />

            <span className="text-base font-medium">Log out</span>
          </button>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
