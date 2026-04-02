import { randomUUIDv7 } from "bun";

interface RedisDBArguments {
  id: string;
  value: string;
  type?: string;
  timestampAdded: number;
  expiresInMs: number;
}
type RedisDB = Record<string, RedisDBArguments>;

const db: RedisDB = {};

export function setKeyValue(textArray: string[]): boolean {
  const numberOfArgs = textArray.length;
  const key = textArray[0];
  const value = textArray[1];
  if (numberOfArgs == 2) {
    setSimpleKeyValue(key, value);
    return true;
  }
  const option = textArray[2].toLowerCase();

  switch (option) {
    case "px":
      let timeMs = +textArray[3];
      if (!timeMs) timeMs = Infinity;
      if (typeof timeMs !== "number") throw new Error("Time must be a number");
      setKeyValueWithPx(key, value, timeMs);
      break;
  }

  return true;
}

function setSimpleKeyValue(key: string, value: string) {
  db[key] = {
    id: randomUUIDv7(),
    value: value,
    timestampAdded: Date.now(),
    expiresInMs: Infinity,
  };
  return;
}

function setKeyValueWithPx(key: string, value: string, timeMs: number) {
  db[key] = {
    id: randomUUIDv7(),
    value: value,
    timestampAdded: Date.now(),
    expiresInMs: timeMs,
  };
}

export function getKeyValue(textArray: string[]): string | null {
  const key = textArray[0];
  const isKeyExpired = isKeyValueExpired(key);
  if (!db[key] || isKeyExpired) return null;
  const value = db[key].value;
  return value;
}

function isKeyValueExpired(key: string) {
  const response = db[key];
  const checkTime = Date.now();
  const { expiresInMs, timestampAdded } = response;
  if (expiresInMs == Infinity) return false;
  const expireTime = expiresInMs + timestampAdded;

  if (checkTime >= expireTime) {
    delete db[key];
    return true;
  }
}
