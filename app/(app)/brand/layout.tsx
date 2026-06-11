import { notFound } from "next/navigation";
import { Lora } from "next/font/google";
import { org } from "@/lib/config";

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
  // The Brand Guide is org-specific content; deployments without a brand
  // pack run with it disabled (NEXT_PUBLIC_BRAND_GUIDE=off).
  if (!org.brandGuideEnabled) notFound();
  return <div className={lora.variable}>{children}</div>;
}
