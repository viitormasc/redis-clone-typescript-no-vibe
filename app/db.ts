const db: Record<string, string> = {};

export function setKeyValue(textArray: string[]): boolean {
  const key = textArray[0];
  const value = textArray[1];
  db[key] = value;
  return true;
}

export function getKeyValue(textArray: string[]): string | null {
  const key = textArray[0];
  if (!db[key]) return null;
  const value = db[key];
  return value;
}
