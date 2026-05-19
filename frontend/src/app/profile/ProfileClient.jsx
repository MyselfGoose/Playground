import { ProfileView } from "../../components/profile/ProfileView.jsx";

/** @deprecated Use ProfileView with mode="self" */
export function ProfileClient() {
  return <ProfileView mode="self" />;
}
