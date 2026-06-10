import type { Metadata } from "next";
import { EmbeddedExample } from "@/components/brand/embedded-example";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Slides · Brand Guide" };

export default function SlidesPage() {
  return (
    <div>
      <PageHeader title="Slides" />
      <EmbeddedExample
        src="/branding/examples/slides.html"
        title="Brand slides — presentation templates"
      />
    </div>
  );
}
