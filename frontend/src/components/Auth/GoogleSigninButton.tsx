import { GoogleIcon } from "@/assets/icons";

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function GoogleSigninButton({ text }: { text: string }) {
  const handleClick = () => {
    window.location.href = `${getBaseUrl()}/api/v1/auth/google`;
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center justify-center gap-3.5 rounded-lg border border-stroke bg-gray-2 p-[15px] font-medium hover:bg-opacity-50 dark:border-dark-3 dark:bg-dark-2 dark:hover:bg-opacity-50"
    >
      <GoogleIcon />
      {text} with Google
    </button>
  );
}
