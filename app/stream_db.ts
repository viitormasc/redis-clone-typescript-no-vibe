import { process } from "zod/v4/core";
import { streamDB, type RedisStreamDBArguments } from "./db_store";

export function getStreamType(key: string): string {
  const dbStream = streamDB[key];
  if (!dbStream) return "none";
  return "stream";
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

export function getStreamRangeInclusive(
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
  finalId = [finalIdMsTime, finalIdIncremental].join("-");
  return [initialId, finalId];
}

export function getStreamRangeExclusive(
  textArray: string[],
): [string, RedisStreamDBArguments[]] | void {
  const streamKey = textArray[1];
  const id = textArray[2];

  const dbStreamValues = streamDB[streamKey];

  if (!dbStreamValues) return;

  const initialIndex = dbStreamValues.findIndex((value) => value.id == id) + 1;

  return [streamKey, dbStreamValues.slice(initialIndex)];
}
