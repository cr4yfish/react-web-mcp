import { Changelog } from "@/components/site/changelog";
import { CodeTabs } from "@/components/site/code-tabs";
import { Features } from "@/components/site/features";
import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { LiveDemo } from "@/components/site/live-demo";

export default function Page() {
  return (
    <main>
      <Hero />
      <Features />
      <LiveDemo />
      <CodeTabs />
      <Changelog />
      <Footer />
    </main>
  );
}
