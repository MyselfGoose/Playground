"use client";

import { useParams } from "next/navigation";
import { ProfileView } from "../../../components/profile/ProfileView.jsx";

export default function PublicProfilePage() {
  const params = useParams();
  const userId = String(params?.userId ?? "");

  return <ProfileView mode="public" userId={userId} />;
}
