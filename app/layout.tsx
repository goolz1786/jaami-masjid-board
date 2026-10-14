import type { Metadata } from 'next';
import {
  Amiri,
  Great_Vibes,
  Inter,
  Lora,
  Merriweather,
  Montserrat,
  Playfair_Display,
  Poppins,
  Roboto_Slab,
} from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
});

const poppins = Poppins({
  variable: '--font-poppins',
  weight: ['400', '600', '700'],
  subsets: ['latin'],
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  weight: ['400', '600', '700'],
  subsets: ['latin'],
});

const lora = Lora({
  variable: '--font-lora',
  weight: ['400', '600', '700'],
  subsets: ['latin'],
});

const merriweather = Merriweather({
  variable: '--font-merriweather',
  weight: ['400', '700'],
  subsets: ['latin'],
});

const robotoSlab = Roboto_Slab({
  variable: '--font-roboto-slab',
  weight: ['400', '600', '700'],
  subsets: ['latin'],
});

const amiri = Amiri({
  variable: '--font-amiri',
  weight: ['400', '700'],
  subsets: ['latin'],
});

const script = Great_Vibes({
  variable: '--font-script',
  weight: '400',
  subsets: ['latin'],
});

const fontVariables = [
  inter.variable,
  montserrat.variable,
  poppins.variable,
  playfair.variable,
  lora.variable,
  merriweather.variable,
  robotoSlab.variable,
  amiri.variable,
  script.variable,
].join(' ');

export const metadata: Metadata = {
  title: "Jaami' Masjid Beyers Park — Digital Display",
  description:
    "Jaami' Masjid Beyers Park programmes, notices and community announcements.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fontVariables} antialiased`}>{children}</body>
    </html>
  );
}
