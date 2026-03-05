/**
 * Script per normalizzare i file .content: devono iniziare con un heading di livello 2.
 * Se iniziano con paragrafo/i, li rimuove e mette il testo nel file .description.
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCUMENTS_DIR = join(__dirname, "..", "data", "documents");

function extractTextFromNode(node: { type: string; text?: string; content?: unknown[] }): string {
  if (node.type === "text" && node.text) {
    return node.text;
  }
  if (node.content && Array.isArray(node.content)) {
    return node.content.map((c) => extractTextFromNode(c as { type: string; text?: string; content?: unknown[] })).join("");
  }
  return "";
}

function processFile(contentPath: string): boolean {
  const content = JSON.parse(readFileSync(contentPath, "utf-8"));
  const nodes = content.content;
  if (!Array.isArray(nodes) || nodes.length === 0) return false;

  const first = nodes[0];
  if (first.type !== "paragraph") return false;

  const paragraphsToRemove: typeof nodes = [];
  let i = 0;
  while (i < nodes.length && nodes[i].type === "paragraph") {
    paragraphsToRemove.push(nodes[i]);
    i++;
  }

  const descriptionText = paragraphsToRemove
    .map((p) =>
      (p.content || [])
        .map((c) => extractTextFromNode(c as { type: string; text?: string; content?: unknown[] }))
        .join("")
    )
    .join("\n\n")
    .trim();

  content.content = nodes.slice(i);
  const baseName = contentPath.replace(/\.content$/, "");
  const descriptionPath = `${baseName}.description`;

  writeFileSync(contentPath, JSON.stringify(content, null, 2), "utf-8");
  writeFileSync(descriptionPath, descriptionText, "utf-8");

  return true;
}

async function main() {
  const files = await glob("*.content", { cwd: DOCUMENTS_DIR });
  let count = 0;
  for (const file of files) {
    const path = join(DOCUMENTS_DIR, file);
    if (processFile(path)) {
      console.log(`✓ ${file}`);
      count++;
    }
  }
  console.log(`\nElaborati ${count} file.`);
}

main().catch(console.error);
