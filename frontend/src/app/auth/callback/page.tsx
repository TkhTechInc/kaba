import { AuthCallbackContent } from "./AuthCallbackContent";

export default function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AuthCallbackContent searchParams={searchParams} />;
}
