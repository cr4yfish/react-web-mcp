import { Changelog } from "@/components/site/changelog";
import { CodeTabs } from "@/components/site/code-tabs";
import { Features } from "@/components/site/features";
import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { LiveDemo } from "@/components/site/live-demo";
import { Nav } from "@/components/site/nav";
import { Roadmap } from "@/components/site/roadmap";
import { SkillPromo } from "@/components/site/skill-promo";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <LiveDemo />
        <CodeTabs />
        <SkillPromo />
        <Roadmap />
        <Changelog />
        <Footer />
      </main>
    </>
  );
}
