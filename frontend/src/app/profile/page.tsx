"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { CameraIcon } from "./_components/icons";
import { SocialAccounts } from "./_components/social-accounts";

const DEFAULT_AVATAR = "/images/user/user-03.png";
const DEFAULT_COVER = "/images/cover/cover-01.png";

export default function Page() {
  const { user, businesses, isLoading } = useAuth();
  const router = useRouter();
  const [profilePhoto, setProfilePhoto] = useState(DEFAULT_AVATAR);
  const [coverPhoto, setCoverPhoto] = useState(DEFAULT_COVER);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth/sign-in");
    }
  }, [user, isLoading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (e.target.name === "profilePhoto") {
      setProfilePhoto(URL.createObjectURL(file));
    } else if (e.target.name === "coverPhoto") {
      setCoverPhoto(URL.createObjectURL(file));
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const displayName = user.phone ?? user.email ?? user.id;
  const roleLabel = user.role === "admin" ? "Administrator" : "Member";

  return (
    <div className="mx-auto w-full max-w-[970px]">
      <Breadcrumb pageName="Profile" />

      <div className="overflow-hidden rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="relative z-20 h-35 md:h-65">
          <Image
            src={coverPhoto}
            alt="profile cover"
            className="h-full w-full rounded-tl-[10px] rounded-tr-[10px] object-cover object-center"
            width={970}
            height={260}
            style={{
              width: "auto",
              height: "auto",
            }}
          />
          <div className="absolute bottom-1 right-1 z-10 xsm:bottom-4 xsm:right-4">
            <label
              htmlFor="coverPhoto"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-[15px] py-[5px] text-body-sm font-medium text-white hover:bg-opacity-90"
            >
              <input
                type="file"
                name="coverPhoto"
                id="coverPhoto"
                className="sr-only"
                onChange={handleChange}
                accept="image/png, image/jpg, image/jpeg"
              />

              <CameraIcon />

              <span>Edit</span>
            </label>
          </div>
        </div>
        <div className="px-4 pb-6 text-center lg:pb-8 xl:pb-11.5">
          <div className="relative z-30 mx-auto -mt-22 h-30 w-full max-w-30 rounded-full bg-white/20 p-1 backdrop-blur sm:h-44 sm:max-w-[176px] sm:p-3">
            <div className="relative drop-shadow-2">
              {profilePhoto && (
                <>
                  <Image
                    src={profilePhoto}
                    width={160}
                    height={160}
                    className="overflow-hidden rounded-full"
                    alt="profile"
                  />

                  <label
                    htmlFor="profilePhoto"
                    className="absolute bottom-0 right-0 flex size-8.5 cursor-pointer items-center justify-center rounded-full bg-primary text-white hover:bg-opacity-90 sm:bottom-2 sm:right-2"
                  >
                    <CameraIcon />

                    <input
                      type="file"
                      name="profilePhoto"
                      id="profilePhoto"
                      className="sr-only"
                      onChange={handleChange}
                      accept="image/png, image/jpg, image/jpeg"
                    />
                  </label>
                </>
              )}
            </div>
          </div>
          <div className="mt-4">
            <h3 className="mb-1 text-heading-6 font-bold text-dark dark:text-white">
              {displayName}
            </h3>
            <p className="font-medium text-dark-4 dark:text-dark-6">{roleLabel}</p>
            <div className="mx-auto mb-5.5 mt-5 grid max-w-[370px] grid-cols-1 rounded-[5px] border border-stroke py-[9px] shadow-1 dark:border-dark-3 dark:bg-dark-2 dark:shadow-card sm:grid-cols-3">
              <div className="flex flex-col items-center justify-center gap-1 border-b border-stroke px-4 py-3 dark:border-dark-3 sm:border-b-0 sm:border-r">
                <span className="font-medium text-dark dark:text-white">
                  {businesses.length}
                </span>
                <span className="text-body-sm">Business{businesses.length !== 1 ? "es" : ""}</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 border-b border-stroke px-4 py-3 dark:border-dark-3 sm:border-b-0 sm:border-r">
                <span className="font-medium text-dark dark:text-white">
                  {user.id}
                </span>
                <span className="text-body-sm">User ID</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 px-4 py-3">
                <span className="font-medium text-dark dark:text-white">
                  {user.phone ? "Phone" : user.email ? "Email" : "—"}
                </span>
                <span className="text-body-sm">Sign-in method</span>
              </div>
            </div>

            <div className="mx-auto max-w-[720px]">
              <h4 className="font-medium text-dark dark:text-white">
                Account
              </h4>
              <p className="mt-4 text-dark-4 dark:text-dark-6">
                Kaba account. Manage your businesses from the dashboard.
              </p>
            </div>

            <SocialAccounts />
          </div>
        </div>
      </div>
    </div>
  );
}
