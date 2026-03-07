import type { DocumentSubtype, SubtypeDocument } from '@/types/document';

function findLeaf(docs: SubtypeDocument[]): SubtypeDocument | null {
  for (const doc of docs) {
    if (!doc.children || doc.children.length === 0) return doc;
    const child = findLeaf(doc.children);
    if (child) return child;
  }
  return null;
}

export function findFirstLeafPath(subtypes: DocumentSubtype[], type: string): string | null {
  for (const subtype of subtypes) {
    const leaf = findLeaf(subtype.documents || []);
    if (leaf) return `/${type}/${leaf.path}`;
  }
  return null;
}
