import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Unveil — Decentralized AI Fact-Checking Platform',
  description: 'An army of 5 specialized AI micro-agents collaborate using weighted consensus to automatically expose biased and fake content on social media. Powered by GPT-4o-mini with real-time web research verification.',
  keywords: ['fact-checking', 'AI', 'misinformation', 'bias detection', 'decentralized AI', 'fake news detector', 'content verification'],
  authors: [{ name: 'Unveil' }],
  openGraph: {
    title: 'Unveil — Decentralized AI Fact-Checking Platform',
    description: '5 AI agents collaborate to expose biased and fake content. Powered by OpenAI with real-time web verification.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Unveil',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Unveil — Decentralized AI Fact-Checking',
    description: '5 AI agents collaborate to expose biased and fake content.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
