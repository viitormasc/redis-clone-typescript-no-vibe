import { randomUUIDv7 } from "bun";
import { process } from "zod/v4/core";

type Key = string;

export type RedisStreamDBArguments = Omit<
  {
    id: string;
  } & Record<string, string>,
  "id"
>;

interface RedisValuesDBArguments {
  id: string;
  value: string[];
  type?: string;
  timestampAdded: number;
  expiresInMs: number;
}
type RedisValuesDB = Record<Key, RedisValuesDBArguments>;
type RedisStreamDB = Record<Key, RedisStreamDBArguments[]>;

const valuesDB: RedisValuesDB = {};
const streamDB: RedisStreamDB = {};

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
  valuesDB[key] = {
    id: randomUUIDv7(),
    value: [value],
    timestampAdded: Date.now(),
    expiresInMs: Infinity,
  };
  return;
}

function setKeyValueWithPx(key: string, value: string, timeMs: number) {
  valuesDB[key] = {
    id: randomUUIDv7(),
    value: [value],
    timestampAdded: Date.now(),
    expiresInMs: timeMs,
  };
}

export function getKeyValue(textArray: string[]): string | null | string[] {
  const key = textArray[0];
  const isKeyExpired = !valuesDB[key] || isKeyValueExpired(key);
  if (isKeyExpired) return null;
  const value = valuesDB[key].value;
  return value;
}

function isKeyValueExpired(key: string) {
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

export function addKeyListValue(textArray: string[]): number | null {
  let [key, ...values] = textArray;
  if (!key || !values) {
    throw new Error("RPUSH command should have a key and a values");
  }
  const isKeyExpired = !valuesDB[key] || isKeyValueExpired(key);

  if (isKeyExpired) {
    const initialValue = values.shift()!!;
    setSimpleKeyValue(key, initialValue);
    if (values.length == 0) return 1;
  }
  let dbValue = valuesDB[key].value;
  if (!Array.isArray(dbValue)) {
    dbValue = [dbValue];
  }
  dbValue.push(...values);
  valuesDB[key].value = dbValue;
  return dbValue.length;
}

export function getKeyListRangeValues(textArray: string[]): string[] {
  let key = textArray[0];
  let start = parseInt(textArray[1]);
  let stop = parseInt(textArray[2]);
  const isKeyExpired = !valuesDB[key] || isKeyValueExpired(key);
  if (isKeyExpired) return [];
  const dbValue = valuesDB[key].value;
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
  const isKeyExpired = !valuesDB[key] || isKeyValueExpired(key);
  if (isKeyExpired) {
    const firstValue = values.shift();
    setSimpleKeyValue(key, firstValue!!);
    if (values.length == 0) return 1;
  }
  const dbValue = dbValueToArray(key);

  values.forEach((value) => {
    dbValue.unshift(value);
  });

  valuesDB[key].value = dbValue;
  return valuesDB[key].value.length;
}

export function getListLength(textArray: string[]): number {
  const key = textArray[0];
  const isKeyExpired = !valuesDB[key] || isKeyValueExpired(key);
  if (isKeyExpired) return 0;

  return valuesDB[key].value.length;
}

export function removeArrayValues(textArray: string[]): string | string[] {
  const key = textArray[0];
  const isKeyExpired = !valuesDB[key] || isKeyValueExpired(key);
  const numberOfValues = Number.parseInt(textArray[1]);
  if (isKeyExpired) return "";
  if (!numberOfValues || typeof valuesDB[key].value == "string") {
    const firstValue =
      typeof valuesDB[key].value == "string"
        ? valuesDB[key].value
        : valuesDB[key].value.shift();

    return firstValue || "";
  } else if (
    Number.isNaN(numberOfValues) &&
    Array.isArray(valuesDB[key].value)
  ) {
    const namedValue = textArray[1];
    valuesDB[key].value = valuesDB[key].value.filter(
      (value) => value !== namedValue,
    );
    return namedValue;
  }
  return valuesDB[key].value.splice(0, numberOfValues);
}

function dbValueToArray(key: string): string[] {
  const dbValue = !Array.isArray(valuesDB[key].value)
    ? [valuesDB[key].value]
    : valuesDB[key].value;

  return dbValue;
}

export async function getBlockedPop(textArray: string[]): Promise<string> {
  const key = textArray[0];
  const timeoutInSec = parseFloat(textArray[1]);
  console.log("timeoutInSec", timeoutInSec);

  if (!key || Number.isNaN(timeoutInSec))
    throw new Error("Blpop command must have list key and timeout in seconds");
  let poppedValue: string;
  if (!valuesDB[key]) {
    poppedValue = await popListValueAsync(key, timeoutInSec);
    return poppedValue;
  }
  poppedValue = popListValue(key) as string;
  return poppedValue;
}

function popListValueAsync(key: string, timeoutInSec: number) {
  let now = Date.now();
  const timeoutInMs = timeoutInSec * 1000 || Infinity;
  const timeLimit = now + timeoutInMs;
  return new Promise<string>((resolve, reject) => {
    setInterval(() => {
      const removedValue = popListValue(key);
      // now = now + 1
      if (Date.now() >= timeLimit) {
        resolve("");
      }
      if (removedValue && Date.now() <= timeLimit) {
        resolve(removedValue);
      } else if (removedValue && Date.now() > timeLimit) {
        resolve("");
      }
    }, 1);
  });
}

function popListValue(key: string) {
  const keyExists = valuesDB[key];
  if (!keyExists) return "";
  return valuesDB[key].value.shift();
}

export function getValueType(textArray: string[]): string {
  const key = textArray[0];
  const isKeyExpired = !valuesDB[key] || isKeyValueExpired(key);
  const isStream = streamDB[key];
  if (isKeyExpired && !isStream) {
    return "none";
  }
  const isValueDB = isKeyExpired ? false : true;
  if (isValueDB) {
    const dbValue = valuesDB[key].value;
    if (dbValue.length == 1) return "string";
  } else {
    const dbStream = streamDB[key];
    if (!dbStream) return "none";
    return "stream";
  }

  return "none";
}

function createStream(
  streamKey: string,
  id: string,
  objectValues: RedisStreamDBArguments,
) {
  streamDB[streamKey] = [
    {
      id: id,
      ...objectValues,
    },
  ];
  return id;
}

function keyValuesArrayToObject(keyValuesArray: string[]) {
  const object: RedisStreamDBArguments = {};
  keyValuesArray.forEach((value, index, array) => {
    if (index % 2 == 0) {
      object[value] = array[index + 1];
    }
  });
  return object;
}

export function addStreamValues(textArray: string[]) {
  const streamKey = textArray[0];
  let id = textArray[1];
  if (id == "0-0")
    return {
      error: true,
      message: "ERR The ID specified in XADD must be greater than 0-0",
    };
  if (id == "*") {
    id = generateFullId(streamKey);
  }
  let [msTime, incremental] = id.split("-").map((value) => parseInt(value));
  if (Number.isNaN(incremental)) {
    incremental = generateIncrementalId(streamKey, msTime);
    id = msTime.toString() + "-" + incremental.toString();
  }
  const keyValuesArray = textArray.slice(2);
  const objectValues = keyValuesArrayToObject(keyValuesArray);
  if (!streamDB[streamKey]) {
    createStream(streamKey, id, objectValues);
    return id;
  }

  const isValidId = validateStreamID(id, streamKey);
  if (isValidId.error) return isValidId;
  streamDB[streamKey].push({
    id: id,
    ...objectValues,
  });
  return id;
}

function validateStreamID(id: string, streamKey: string) {
  const [msTime, incremental] = id.split("-").map((value) => parseInt(value));
  const lastStreamItem = streamDB[streamKey].slice(-1)[0];
  const lastId = lastStreamItem.id;
  const [lastIdMsTime, lastIdIncremental] = lastId
    .split("-")
    .map((value) => parseInt(value));

  if (lastIdMsTime > msTime) {
    return {
      error: true,
      message:
        "ERR The ID specified in XADD is equal or smaller than the target stream top item",
    };
  }

  if (lastIdMsTime == msTime) {
    if (lastIdIncremental + 1 !== incremental)
      return {
        error: true,
        message:
          "ERR The ID specified in XADD is equal or smaller than the target stream top item",
      };
  }

  return { error: false, message: "" };
}

function generateIncrementalId(streamKey: string, msTime: number) {
  const stream = streamDB[streamKey];
  if (!stream && msTime !== 0) return 0;
  if (!stream && msTime == 0) return 1;
  const lastId = stream.slice(-1)[0].id;
  const [lastIdMsTime, lastIdIncremental] = lastId
    .split("-")
    .map((value) => Number.parseInt(value));
  let incremental = 0;
  if (lastIdMsTime == msTime) {
    incremental = lastIdIncremental + 1;
  }
  return incremental;
}

function generateFullId(streamKey: string) {
  let msTime: number;
  let incremental: number;
  msTime = Date.now();
  incremental = generateIncrementalId(streamKey, msTime);
  return msTime.toString() + "-" + incremental.toString();
}

export function getStreamRange(
  textArray: string[],
): RedisStreamDBArguments[] | void {
  let [streamKey, initialId, finalId] = textArray;
  let streamValues: RedisStreamDBArguments[];
  if (!streamDB[streamKey]) {
    return;
  }
  [initialId, finalId] = processStreamIds(initialId, finalId);
  let getAllValuesFromId = false;
  if (finalId[-1] == "*") getAllValuesFromId = true;

  const allDbStreamValues = streamDB[streamKey];
  const firstIndex =
    initialId == "-"
      ? 0
      : allDbStreamValues.findIndex((value) => value.id == initialId);
  const lastIndex =
    finalId[0] == "+"
      ? streamDB[streamKey].length
      : allDbStreamValues.findLastIndex((value) => {
          if (getAllValuesFromId) {
            return value.id.split("-")[0] == finalId.split("-")[0];
          }
          return value.id == finalId;
        });
  streamValues = allDbStreamValues.slice(firstIndex, lastIndex + 1);
  return streamValues;
}

function processStreamIds(initialId: string, finalId: string): string[] {
  let [initialIdMsTime, initialIdIncremental] = initialId.split("-");
  let [finalIdMsTime, finalIdIncremental] = finalId.split("-");

  if (initialIdIncremental == undefined) initialIdIncremental = "0";
  if (finalIdIncremental == undefined) {
    finalIdIncremental = "*";
  }
  initialId = [initialIdMsTime, initialIdIncremental].join("-");
  console.log("initialId", initialId);
  finalId = [finalIdMsTime, finalIdIncremental].join("-");
  console.log("finalId", finalId);
  return [initialId, finalId];
}
