/**
 * React-free entry point: `import { registerTool } from "react-web-mcp/vanilla"`.
 * Safe to import from server components and non-React code.
 */
export {
  DEFAULT_MAX_RESULT_LENGTH,
  getModelContext,
  isWebMCPSupported,
  isWebMCPTestingSupported,
  jsonResult,
  normalizeResult,
  provideContext,
  registerTool,
  textResult,
  toolFormAttrs,
  toolParamAttrs,
} from "./core";
export { applyArgsToForm, extractFormSchema } from "./form";
export type {
  JSONSchema,
  ModelContext,
  RegisterToolOptions,
  ToolAnnotations,
  ToolExecuteResult,
  ToolResponse,
  ToolResponseContent,
  WebMCPSubmitEvent,
  WebMCPTool,
} from "./types";
