import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((path) => !path.endsWith("package-lock.json"));

const rules = [
  { name: "private-key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "openai-key", regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { name: "postgres-credential", regex: /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s/]{8,}@[^\s"']+/gi },
  { name: "mercado-pago-token", regex: /\bAPP_USR-[A-Za-z0-9_-]{20,}\b/g },
  { name: "meta-access-token", regex: /\bEA[A-Za-z0-9]{80,}\b/g },
  { name: "github-token", regex: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g },
];

const findings = [];
for (const path of tracked) {
  if (isAllowedExample(path)) continue;
  let text;
  try { text = readFileSync(path, "utf8"); } catch { continue; }
  if (text.includes("\u0000")) continue;
  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    for (const match of text.matchAll(rule.regex)) {
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({ path, line, rule: rule.name, preview: redact(match[0]) });
    }
  }
}

if (findings.length) {
  console.error("Potential secrets detected in tracked files:");
  for (const finding of findings) {
    console.error(`- ${finding.path}:${finding.line} [${finding.rule}] ${finding.preview}`);
  }
  console.error("Rotate any real credential before removing it from Git history.");
  process.exit(1);
}

console.log(`Secret scan passed (${tracked.length} tracked files checked).`);

function isAllowedExample(path) {
  return /(^|\/)\.env(?:\.[^/]+)?\.example$/.test(path);
}

function redact(value) {
  if (value.length <= 10) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
