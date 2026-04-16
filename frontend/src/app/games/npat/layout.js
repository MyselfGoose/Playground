import { NpatProvider } from "../../../lib/npat/NpatSocketContext.jsx";

export const metadata = {
  title: "Name Place Animal Thing — Playground",
  description: "Real-time multiplayer NPAT with friends.",
};

export default function NpatLayout({ children }) {
  return <NpatProvider>{children}</NpatProvider>;
}
