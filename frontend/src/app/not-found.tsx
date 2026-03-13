import { ErrorView } from "@/components/ui/error-view";

export default function NotFound() {
  return (
    <ErrorView
      code={404}
      primaryHref="/"
      fullPage
    />
  );
}
