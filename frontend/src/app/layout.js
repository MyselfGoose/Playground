import { Nunito } from "next/font/google";
import "./globals.css";
import { UserProvider } from "../lib/context/UserContext.jsx";
import { Shell } from "../components/Shell.jsx";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata = {
  title: "Playground — Multi-game fun",
  description: "A playful hub for typing races, trivia, hangman, and more.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <UserProvider>
          <Shell>{children}</Shell>
        </UserProvider>
      </body>
    </html>
  );
}
