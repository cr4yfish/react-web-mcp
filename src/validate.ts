/**
 * Minimal, dependency-free JSON Schema validation for tool inputs.
 *
 * The WebMCP spec treats `inputSchema` as documentation — browsers do not
 * enforce it, and the agent is an untrusted client that may call a tool with
 * any arguments at any time. This validator closes that gap for the common
 * keywords so tools don't have to hand-roll `typeof` checks in `execute`.
 *
 * It is deliberately conservative: only keywords it fully understands are
 * checked, and any schema node using composition (`$ref`, `anyOf`, `oneOf`,
 * `allOf`, `not`, `if`) is skipped entirely rather than risking a false
 * rejection. Unknown keywords are ignored, exactly like a missing schema.
 */
import type { JSONSchema } from "./types";

const SKIP_KEYWORDS = ["$ref", "anyOf", "oneOf", "allOf", "not", "if"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      // Unknown type keyword — don't reject what we don't understand.
      return true;
  }
}

function validateNode(
  value: unknown,
  schema: JSONSchema,
  path: string,
  problems: string[],
  depth: number,
): void {
  // Hard depth cap so a (malformed) cyclic schema object can never loop.
  if (depth > 32) return;
  if (!isPlainObject(schema)) return;
  // Composition keywords need a real validator — skip this node entirely
  // instead of half-checking it.
  if (SKIP_KEYWORDS.some((keyword) => schema[keyword] !== undefined)) return;

  const label = path === "" ? "arguments" : `"${path}"`;

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const stringTypes = types.filter((t): t is string => typeof t === "string");
    if (
      stringTypes.length > 0 &&
      !stringTypes.some((type) => matchesType(value, type))
    ) {
      problems.push(
        `${label} must be of type ${stringTypes.join(" | ")} (got ${describe(value)})`,
      );
      return; // Remaining keyword checks assume the right type.
    }
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    if (!schema.enum.some((allowed) => allowed === value)) {
      problems.push(
        `${label} must be one of: ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}`,
      );
      return;
    }
  }

  if (schema.const !== undefined && schema.const !== value) {
    problems.push(`${label} must be ${JSON.stringify(schema.const)}`);
    return;
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      problems.push(`${label} must be at least ${schema.minLength} characters`);
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      problems.push(`${label} must be at most ${schema.maxLength} characters`);
    }
    if (typeof schema.pattern === "string") {
      try {
        if (!new RegExp(schema.pattern).test(value)) {
          problems.push(`${label} must match pattern ${schema.pattern}`);
        }
      } catch {
        // Invalid pattern in the schema — not the caller's fault, skip.
      }
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      problems.push(`${label} must be >= ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      problems.push(`${label} must be <= ${schema.maximum}`);
    }
    if (
      typeof schema.exclusiveMinimum === "number" &&
      value <= schema.exclusiveMinimum
    ) {
      problems.push(`${label} must be > ${schema.exclusiveMinimum}`);
    }
    if (
      typeof schema.exclusiveMaximum === "number" &&
      value >= schema.exclusiveMaximum
    ) {
      problems.push(`${label} must be < ${schema.exclusiveMaximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      problems.push(`${label} must have at least ${schema.minItems} items`);
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      problems.push(`${label} must have at most ${schema.maxItems} items`);
    }
    // Tuple form (items as an array of schemas) is rare — only validate the
    // common single-schema form.
    if (isPlainObject(schema.items)) {
      value.forEach((item, index) => {
        validateNode(
          item,
          schema.items as JSONSchema,
          path === "" ? `[${index}]` : `${path}[${index}]`,
          problems,
          depth + 1,
        );
      });
    }
  }

  if (isPlainObject(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (typeof key === "string" && value[key] === undefined) {
          problems.push(`missing required argument "${path === "" ? key : `${path}.${key}`}"`);
        }
      }
    }
    if (isPlainObject(schema.properties)) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (value[key] !== undefined) {
          validateNode(
            value[key],
            propertySchema,
            path === "" ? key : `${path}.${key}`,
            problems,
            depth + 1,
          );
        }
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!(key in schema.properties)) {
            problems.push(`unexpected argument "${path === "" ? key : `${path}.${key}`}"`);
          }
        }
      }
    }
  }
}

/**
 * Validates a tool's arguments against its `inputSchema` and returns a list
 * of human-readable problems (empty when the arguments are valid, when there
 * is no schema, or when the schema only uses constructs this validator
 * doesn't understand).
 *
 * Checked keywords: `type` (incl. arrays of types), `required`, `properties`
 * (recursive), `additionalProperties: false`, `enum`, `const`, `minLength`,
 * `maxLength`, `pattern`, `minimum`, `maximum`, `exclusiveMinimum`,
 * `exclusiveMaximum`, `minItems`, `maxItems`, and single-schema `items`.
 * Nodes using `$ref` / `anyOf` / `oneOf` / `allOf` / `not` / `if` are skipped.
 */
export function validateToolInput(
  args: unknown,
  schema: JSONSchema | undefined,
): string[] {
  if (!isPlainObject(schema)) return [];
  const problems: string[] = [];
  // Agents may omit the arguments object entirely for no-arg calls; validate
  // object schemas against `{}` in that case so `required` still applies.
  const value =
    args === undefined && (schema.type === "object" || schema.properties)
      ? {}
      : args;
  validateNode(value, schema, "", problems, 0);
  return problems;
}
