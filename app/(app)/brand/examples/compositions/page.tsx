import type { Metadata } from "next";
import { EmbeddedExample } from "@/components/brand/embedded-example";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Compositions · Brand Guide" };

export default function CompositionsPage() {
  return (
    <div>
      <PageHeader title="Compositions" />
      <EmbeddedExample
        src="/branding/examples/compositions.html"
        title="Brand compositions — mixed light, dark, and photo-anchored layouts"
      />
    </div>
  );
}
