"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const MultiRaceRoomView = dynamic(
  () =>
    import("../../../../../../components/typing-race/MultiRaceRoomView.jsx").then((m) => ({
      default: m.MultiRaceRoomView,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="multi-phase-enter mx-auto w-full max-w-2xl flex-1 px-4 py-16"
        aria-busy="true"
        aria-label="Loading room"
      >
        <div className="multi-spinner mx-auto" aria-hidden />
      </div>
    ),
  },
);

export default function TypingMultiRoomPage() {
  const params = useParams();
  const code = typeof params?.code === "string" ? params.code : "";
  return <MultiRaceRoomView roomCode={code} />;
}
