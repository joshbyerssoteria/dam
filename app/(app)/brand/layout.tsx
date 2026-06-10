import type { Metadata } from "next";
import { Lora } from "next/font/google";
import { BrandSubnav } from "@/components/brand/brand-subnav";
import { PageHeader } from "@/components/page-header";

const lora = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-lora",
});

export const metadata: Metadata = { title: "Brand Guide" };

export default function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={lora.variable}>
      <PageHeader
        title="Brand Guide"
        description="The Soteria brand system — how we look, sound, and show up."
      />
      <BrandSubnav />
      {children}
    </div>
  );
}
