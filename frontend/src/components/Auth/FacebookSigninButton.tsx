import { FacebookIcon } from "@/assets/icons";

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function FacebookSigninButton({ text }: { text: string }) {
  const facebookAuthUrl = `${getBaseUrl()}/api/v1/auth/facebook`;

  return (
    <a
      href={facebookAuthUrl}
      className="flex w-full items-center justify-center gap-3.5 rounded-lg border border-stroke bg-gray-2 p-[15px] font-medium hover:bg-opacity-50 dark:border-dark-3 dark:bg-dark-2 dark:hover:bg-opacity-50"
    >
      <FacebookIcon />
      {text} with Facebook
    </a>
  );
}
