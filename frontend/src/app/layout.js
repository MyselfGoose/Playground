import { Nunito } from "next/font/google";
import "./globals.css";
import { UserProvider } from "../lib/context/UserContext.jsx";
import { Shell } from "../components/Shell.jsx";
import { ThemeProvider } from "../components/ThemeProvider.jsx";

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
    <html lang="en" className={`${nunito.variable} h-full antialiased bg-background light`} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const shouldBeDark = theme === 'dark' || (theme !== 'light' && prefersDark);
                if (shouldBeDark) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                } else {
                  document.documentElement.classList.add('light');
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full font-sans bg-background">
        <ThemeProvider>
          <UserProvider>
            <Shell>{children}</Shell>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
