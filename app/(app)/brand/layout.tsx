import { Lora } from "next/font/google";

const lora = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-lora",
});

export default function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={lora.variable}>{children}</div>;
}
