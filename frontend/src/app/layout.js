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
  viewport: {
    width: "device-width",
    initialScale: 1,
    colorScheme: "light dark",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased bg-background`} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-full font-sans bg-background">
        <UserProvider>
          <Shell>{children}</Shell>
        </UserProvider>
      </body>
    </html>
  );
}
