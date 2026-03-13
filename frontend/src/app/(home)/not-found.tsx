import { ErrorView } from "@/components/ui/error-view";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <div className="w-full max-w-lg">
        <ErrorView
          code={404}
          primaryHref="/"
          secondaryHref="javascript:history.back()"
        />
      </div>
    </div>
  );
}
