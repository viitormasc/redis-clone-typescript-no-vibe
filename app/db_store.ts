import { randomUUIDv7 } from "bun";
import type { UUID } from "crypto";

export type Key = string;
export type RedisValue = string;
export type RedisList = RedisValue[];
export type RedisStreamFieldValues = Record<string, RedisValue>;
export type TextArray = string[];
export type CommandName = string;
export type ConnectionUUID = UUID;
export type QueuedCommand = {
  command: CommandName;
  textArray: TextArray;
};
export type TransactionState = {
  uuid: UUID;
  open: boolean;
  queue: QueuedCommand[];
  role: "master" | "replica";
};
export type StringError = string;
export type ResponseWithSuccess = {
  success: boolean;
  message: string;
};
export type Id = string;
export type StreamKeyIds = {
  streamKeys: StreamKey[];
  ids: Id[];
};
export type StreamKey = string;
export type StreamReadData = [StreamKey, RedisStreamEntry[]][];
export interface RedisStreamEntry {
  id: string;
  values: RedisStreamFieldValues;
}

export interface RedisValuesDBArguments {
  id: string;
  value: RedisList;
  type?: string;
  timestampAdded: number;
  expiresInMs: number;
}

export type RedisValuesDB = Record<Key, RedisValuesDBArguments>;
export type RedisStreamDB = Record<Key, RedisStreamEntry[]>;

export const valuesDB: RedisValuesDB = {};
export const streamDB: RedisStreamDB = {};

export function setSimpleKeyValue(key: string, value: string) {
  valuesDB[key] = {
    id: randomUUIDv7(),
    value: [value],
    timestampAdded: Date.now(),
    expiresInMs: Infinity,
  };
}

export function setKeyValueWithPx(key: string, value: string, timeMs: number) {
  valuesDB[key] = {
    id: randomUUIDv7(),
    value: [value],
    timestampAdded: Date.now(),
    expiresInMs: timeMs,
  };
}

export function isKeyValueExpired(key: string) {
  const response = valuesDB[key];
  if (!response) return true;
  const checkTime = Date.now();
  const { expiresInMs, timestampAdded } = response;
  if (expiresInMs == Infinity) return false;
  const expireTime = expiresInMs + timestampAdded;

  if (checkTime >= expireTime) {
    delete valuesDB[key];
    return true;
  }
}

export function dbValueToArray(key: string): string[] {
  const dbValue = !Array.isArray(valuesDB[key].value)
    ? [valuesDB[key].value]
    : valuesDB[key].value;

  return dbValue;
}

export function popListValue(key: string) {
  const keyExists = valuesDB[key];
  if (!keyExists) return "";
  return valuesDB[key].value.shift();
}
