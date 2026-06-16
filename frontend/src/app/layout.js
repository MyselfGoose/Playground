import { Nunito } from "next/font/google";
import { THEME_INIT_SCRIPT } from "../lib/theme/themeInitScript.js";
import "./globals.css";
import { UserProvider } from "../lib/context/UserContext.jsx";
import { GameSessionProvider } from "../lib/session/GameSessionContext.jsx";
import { FriendsProvider } from "../lib/friends/FriendsContext.jsx";
import { Shell } from "../components/Shell.jsx";
import { ThemeProvider } from "../lib/theme/ThemeProvider.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";
import { ErrorReporterInit } from "../components/ErrorReporterInit.jsx";
import { RuntimeConfig } from "../components/RuntimeConfig.jsx";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata = {
  title: "Playground — Multi-game fun",
  description:
    "Playground — five multiplayer games in the browser: typing race, NPAT, Taboo, Cards Against Humanity, and Hangman.",
  viewport: {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    colorScheme: "light dark",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} h-full antialiased bg-background`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans bg-background">
        <RuntimeConfig />
        <ErrorReporterInit />
        <ThemeProvider>
          <ErrorBoundary level="app">
            <UserProvider>
              <GameSessionProvider>
                <FriendsProvider>
                  <Shell>{children}</Shell>
                </FriendsProvider>
              </GameSessionProvider>
            </UserProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
