import { AppDb } from '../db/dexie';
import { createDexieRepositories } from './dexieRepositories';
import type { Repositories } from './types';

let current: Repositories | null = null;

/** Репозитории приложения (по умолчанию — IndexedDB через Dexie). */
export function getRepositories(): Repositories {
  current ??= createDexieRepositories(new AppDb());
  return current;
}

/** Подмена реализации — для тестов и будущей синхронизации. */
export function setRepositories(repos: Repositories): void {
  current = repos;
}

export type { Repositories } from './types';
