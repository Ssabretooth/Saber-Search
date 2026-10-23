"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="space-y-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Records are temporarily unavailable</h1>
      <p className="text-sm text-gray-600">
        We could not load the public records right now. Please try again shortly.
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </section>
  );
}
