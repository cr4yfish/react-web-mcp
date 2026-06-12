import type { Metadata } from "next";
import { Footer } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { SkillContent } from "@/components/site/skill-content";
import { SkillHero } from "@/components/site/skill-hero";

export const metadata: Metadata = {
  title: "web-mcp-skill — teach your agent WebMCP, any framework",
  description:
    "A single agent skill that turns your coding assistant into a WebMCP expert. Framework-agnostic — vanilla JS, React, Vue, Svelte, Angular. Install with npx skills add cr4yfish/web-mcp-skill.",
  openGraph: {
    title: "web-mcp-skill — WebMCP for every framework",
    description:
      "The whole WebMCP standard distilled into one agent skill. Works on everything, not just React.",
    type: "website",
  },
};

export default function SkillPage() {
  return (
    <>
      <Nav />
      <main>
        <SkillHero />
        <SkillContent />
        <Footer />
      </main>
    </>
  );
}
