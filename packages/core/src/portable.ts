// Ulaz bez Node zavisnosti (preglednik, workeri). `validate()` ovdje nema:
// pozivalac daje `EngineRuntime` i zove `runValidation()`.
export * from "./types.js";
export { NS, SVRL_NS } from "./namespaces.js";
export { parseSvrl, extractBusinessTerms, stripRulePrefix } from "./svrl.js";
export { messagesFor, pickMessage, catalogStats, overrideHint } from "./messages.js";
export { detectSyntax, summarizeUbl } from "./detect.js";
export { runValidation, type EngineRuntime } from "./engine.js";
export {
  registerProfile,
  listProfiles,
  resolveProfiles,
  type ProfileDefinition,
} from "./profiles.js";
