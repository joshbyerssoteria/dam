import type { Metadata } from "next";
import { EmbeddedExample } from "@/components/brand/embedded-example";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Components · Brand Guide" };

export default function ComponentsPage() {
  return (
    <div>
      <PageHeader title="Components" />
      <EmbeddedExample
        src="/branding/examples/components.html"
        title="Brand components — buttons, forms, navigation, feedback"
      />
    </div>
  );
}
