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
  metadataBase: new URL('https://unveil.example.com'),
  title: {
    default: 'Unveil — Multi-Agent AI Fact-Checking Platform',
    template: '%s | Unveil'
  },
  description: 'An army of 5 specialized AI micro-agents collaborate using weighted consensus to automatically expose biased and fake content on social media. Powered by GPT-4o-mini with real-time web research verification.',
  keywords: ['fact-checking', 'AI', 'misinformation', 'bias detection', 'multi-agent AI', 'fake news detector', 'content verification', 'social media analysis'],
  authors: [{ name: 'Unveil' }],
  creator: 'Unveil Team',
  openGraph: {
    title: 'Unveil — Multi-Agent AI Fact-Checking',
    description: '5 AI agents collaborate to expose biased and fake content. Powered by OpenAI with real-time web verification.',
    url: 'https://unveil.example.com',
    siteName: 'Unveil',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Unveil — Multi-Agent AI Fact-Checking',
    description: '5 AI agents collaborate to expose biased and fake content.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Unveil — Multi-Agent AI Fact-Checking',
    description: 'An army of 5 specialized AI micro-agents collaborate using weighted consensus to automatically expose biased and fake content on social media.',
    applicationCategory: 'Utility',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    }
  };

  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
