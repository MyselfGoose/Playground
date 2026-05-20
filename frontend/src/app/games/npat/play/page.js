"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { LoadingSkeleton } from "../../../../components/LoadingSkeleton.jsx";

const NpatPlayClient = dynamic(
  () => import("./NpatPlayClient.jsx").then((m) => ({ default: m.NpatPlayClient })),
  { ssr: false, loading: () => <LoadingSkeleton variant="playfield" /> },
);

export default function NpatPlayPage() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="playfield" />}>
      <NpatPlayClient />
    </Suspense>
  );
}
