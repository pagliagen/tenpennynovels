import { Model } from 'mongoose';

interface RegistryEntry {
  model: () => Model<any>;
  displayNameField: string;
}

const registry = new Map<string, RegistryEntry>();

export function registerSoftDeleteModel(
  collectionName: string,
  modelGetter: () => Model<any>,
  displayNameField: string
): void {
  registry.set(collectionName, { model: modelGetter, displayNameField });
}

export function getModelForCollection(collectionName: string): Model<any> | undefined {
  const entry = registry.get(collectionName);
  return entry?.model();
}

export function getDisplayNameField(collectionName: string): string {
  return registry.get(collectionName)?.displayNameField || 'name';
}

export function getRegisteredCollections(): string[] {
  return Array.from(registry.keys());
}
