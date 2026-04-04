import { randomUUIDv7 } from "bun";
import { number } from "zod";

type Key = string;

interface RedisDBArguments {
  id: string;
  value: string | string[];
  type?: string;
  timestampAdded: number;
  expiresInMs: number;
}
type RedisDB = Record<Key, RedisDBArguments>;

const db: RedisDB = {};

export function setKeyValue(textArray: string[]): boolean {
  const numberOfArgs = textArray.length;
  const [key, value] = textArray;
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

export function getKeyValue(textArray: string[]): string | null | string[] {
  const key = textArray[0];
  const isKeyExpired = isKeyValueExpired(key);
  if (!db[key] || isKeyExpired) return null;
  const value = db[key].value;
  return value;
}

function isKeyValueExpired(key: string) {
  const response = db[key];
  if (!response) return true;
  const checkTime = Date.now();
  const { expiresInMs, timestampAdded } = response;
  if (expiresInMs == Infinity) return false;
  const expireTime = expiresInMs + timestampAdded;

  if (checkTime >= expireTime) {
    delete db[key];
    return true;
  }
}

export function addKeyListValue(textArray: string[]): number | null {
  let [key, ...values] = textArray;
  if (!key || !values) {
    throw new Error("RPUSH command should have a key and a values");
  }
  const isKeyExpired = isKeyValueExpired(key);

  if (isKeyExpired) {
    const initialValue = values.shift()!!;
    setSimpleKeyValue(key, initialValue);
    if (values.length == 0) return 1;
  }
  let dbValue = db[key].value;
  if (!Array.isArray(dbValue)) {
    dbValue = [dbValue];
  }
  dbValue.push(...values);
  db[key].value = dbValue;
  return dbValue.length;
}

export function getKeyListRangeValues(textArray: string[]): string[] {
  let key = textArray[0];
  let start = parseInt(textArray[1]);
  let stop = parseInt(textArray[2]);
  const isKeyExpired = db[key];
  if (!isKeyExpired) return [];
  const dbValue = db[key].value;
  const valuesLength = dbValue.length;
  let listResponse: string[] | string;
  let conditional =
    !dbValue ||
    start >= valuesLength ||
    start > stop ||
    Number.isNaN(start) ||
    Number.isNaN(stop);

  if (start < 0 || stop < 0) {
    conditional = conditional && stop > start;
  }

  if (conditional) {
    return [];
  }
  if (start < 0) {
    start = -start > valuesLength ? 0 : valuesLength + start;
  }
  if (stop < 0) {
    stop = valuesLength + stop;
  } else {
    stop = stop > valuesLength ? valuesLength : stop;
  }
  listResponse = dbValue.slice(start, stop + 1)!!;
  if (!Array.isArray(listResponse)) listResponse = [listResponse];
  return listResponse;
}

export function pushListValues(textArray: string[]): number {
  const key = textArray[0];
  const values = textArray.slice(1);
  if (!key || !values) return 0;
  const isKeyExpired = isKeyValueExpired(key);
  if (isKeyExpired) {
    const firstValue = values.shift();
    setSimpleKeyValue(key, firstValue!!);
    if (values.length == 0) return 1;
  }
  const dbValue = !Array.isArray(db[key].value)
    ? [db[key].value]
    : db[key].value;

  values.forEach((value) => {
    dbValue.unshift(value);
  });

  db[key].value = dbValue;
  return db[key].value.length;
}

export function getListLength(textArray: string[]): number {
  const key = textArray[0];
  if (!db[key]) return 0;

  return db[key].value.length;
}
