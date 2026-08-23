import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PickedFile } from '../../../src/features/import/types';

/** Lee una fixture del disco tal cual, sin interpretarla. */
export function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(__dirname, name)));
}

export function fixtureText(name: string): string {
  return readFileSync(join(__dirname, name), 'utf8');
}

/** La fixture presentada como si la acabara de elegir la persona usuaria. */
export function fixtureFile(name: string): PickedFile {
  return { name, bytes: fixtureBytes(name) };
}
