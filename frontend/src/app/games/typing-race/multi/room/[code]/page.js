"use client";

import { useParams } from "next/navigation";
import { MultiRaceRoomView } from "../../../../../../components/typing-race/MultiRaceRoomView.jsx";

export default function TypingMultiRoomPage() {
  const params = useParams();
  const code = typeof params?.code === "string" ? params.code : "";
  return <MultiRaceRoomView roomCode={code} />;
}
