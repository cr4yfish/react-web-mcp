"use client";

import { motion } from "motion/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "./code-block";

const HOOK = `import { useWebMCPTool } from "@cr4yfish/react-web-mcp";

function TodoList() {
  const [todos, setTodos] = useState<string[]>([]);

  useWebMCPTool({
    name: "add-todo",
    description: "Add an item to the user's todo list",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    execute: ({ text }) => {
      setTodos((prev) => [...prev, text]); // fresh state, no memoization
      return \`Added "\${text}"\`;
    },
  });

  return <ul>{todos.map((t) => <li key={t}>{t}</li>)}</ul>;
}`;

const FORM = `import { ToolForm, toolParamAttrs } from "@cr4yfish/react-web-mcp";

<ToolForm
  name="book-table"
  description="Books a table. Party size and date."
  onAgentSubmit={async (data) => {
    const res = await book(data); // respondWith, no navigation
    return \`Confirmed: \${res.code}\`;
  }}
>
  <input name="partySize" type="number" min={1} max={12} required
         {...toolParamAttrs("Number of guests")} />
  <input name="date" type="date" required
         {...toolParamAttrs("Reservation date")} />
  <button type="submit">Book</button>
</ToolForm>
// agent fills → user reviews & submits (human-in-the-loop default)`;

const FORM_TOOL = `import { useFormTool } from "@cr4yfish/react-web-mcp";

function Checkout() {
  const formRef = useRef<HTMLFormElement>(null);

  // Schema comes from the rendered DOM — works with MUI/AntD/anything
  useFormTool({
    formRef,
    name: "fill-checkout",
    description: "Fills the checkout form with shipping details.",
  });

  return (
    <form ref={formRef}>
      <TextField name="street" label="Street" required />
      <Select name="country" label="Country">…</Select>
      <Button type="submit">Order</Button>
    </form>
  );
}`;

const VANILLA = `// React-free entry — server-component-safe imports
import { registerTool } from "@cr4yfish/react-web-mcp/vanilla";

const unregister = registerTool({
  name: "get-cart",
  description: "Returns the cart contents as JSON.",
  annotations: { readOnlyHint: true },
  execute: () => cartStore.getState(), // objects auto-serialized + capped
});`;

export function CodeTabs() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Four ways in.
        </h2>
        <Tabs defaultValue="hook" className="mt-6">
          <TabsList>
            <TabsTrigger value="hook">useWebMCPTool</TabsTrigger>
            <TabsTrigger value="form">ToolForm</TabsTrigger>
            <TabsTrigger value="formtool">useFormTool</TabsTrigger>
            <TabsTrigger value="vanilla">/vanilla</TabsTrigger>
          </TabsList>
          <TabsContent value="hook"><CodeBlock code={HOOK} /></TabsContent>
          <TabsContent value="form"><CodeBlock code={FORM} /></TabsContent>
          <TabsContent value="formtool"><CodeBlock code={FORM_TOOL} /></TabsContent>
          <TabsContent value="vanilla"><CodeBlock code={VANILLA} /></TabsContent>
        </Tabs>
      </motion.div>
    </section>
  );
}
