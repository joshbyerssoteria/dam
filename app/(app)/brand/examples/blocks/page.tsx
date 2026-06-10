import type { Metadata } from "next";
import { EmbeddedExample } from "@/components/brand/embedded-example";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Blocks · Brand Guide" };

export default function BlocksPage() {
  return (
    <div>
      <PageHeader title="Blocks" />
      <EmbeddedExample
        src="/branding/examples/blocks.html"
        title="Brand blocks — reusable content modules"
      />
    </div>
  );
}
