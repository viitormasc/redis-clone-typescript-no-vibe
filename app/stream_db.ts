import {
  streamDB,
  type Id,
  type RedisStreamEntry,
  type RedisStreamFieldValues,
  type StreamKey,
  type StreamKeyIds,
  type StreamReadData,
  type TextArray,
} from "./db_store";
import { parseStreamId, splitStreamId } from "./command_parsers";

export function getStreamType(key: string): string {
  const dbStream = streamDB[key];
  if (!dbStream) return "none";
  return "stream";
}

function createStream(
  streamKey: string,
  id: string,
  objectValues: RedisStreamFieldValues,
) {
  streamDB[streamKey] = [
    {
      id: id,
      values: objectValues,
    },
  ];
  return id;
}

function keyValuesArrayToObject(keyValuesArray: string[]) {
  const object: RedisStreamFieldValues = {};
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
  let [msTime, incremental] = parseStreamId(id);
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
    values: objectValues,
  });
  return id;
}

function validateStreamID(id: string, streamKey: string) {
  const [msTime, incremental] = parseStreamId(id);
  const lastStreamItem = streamDB[streamKey].slice(-1)[0];
  const lastId = lastStreamItem.id;
  const [lastIdMsTime, lastIdIncremental] = parseStreamId(lastId);

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
  const [lastIdMsTime, lastIdIncremental] = parseStreamId(lastId);
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
): RedisStreamEntry[] | void {
  let [streamKey, initialId, finalId] = textArray;
  let streamValues: RedisStreamEntry[];
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
  let [initialIdMsTime, initialIdIncremental] = splitStreamId(initialId);
  let [finalIdMsTime, finalIdIncremental] = splitStreamId(finalId);

  if (initialIdIncremental == undefined) initialIdIncremental = "0";
  if (finalIdIncremental == undefined) {
    finalIdIncremental = "*";
  }
  initialId = [initialIdMsTime, initialIdIncremental].join("-");
  finalId = [finalIdMsTime, finalIdIncremental].join("-");
  return [initialId, finalId];
}

export async function getStreamRangeExclusive(
  textArray: string[],
): Promise<StreamReadData | void> {
  const parameter = textArray.shift();
  let streamLength: number;
  let numberOfStreamKeys: number;
  if (parameter?.toLowerCase() == "block") {
    const msBlockTime = Number.parseInt(textArray.shift()!!);
    // get rid of the streams name
    textArray.shift();
    if (Number.isNaN(msBlockTime)) {
      return;
    }
    streamLength = textArray.length;
    numberOfStreamKeys = streamLength / 2;
    return await processStreamRangeExclusiveAsync(
      numberOfStreamKeys,
      textArray,
      msBlockTime,
    );
  }
  streamLength = textArray.length;
  numberOfStreamKeys = streamLength / 2;
  return processStreamRangeExclusive(numberOfStreamKeys, textArray);
}

function processStreamRangeExclusive(
  numberOfStreamKeys: number,
  textArray: TextArray,
): StreamReadData {
  const { streamKeys, ids } = getStreamKeysAndIds(
    textArray,
    numberOfStreamKeys,
  );
  const extractedValues: StreamReadData | void = [];
  streamKeys.forEach((streamKey, index) => {
    const dbStreamValues = getStreamValues(streamKey);
    if (!dbStreamValues) return;
    const initialIndex =
      dbStreamValues.findIndex((value) => value.id == ids[index]) + 1;
    const extractedValuesFromStream = dbStreamValues.slice(initialIndex);
    if (extractedValuesFromStream.length == 0) return;
    extractedValues.push([streamKey, extractedValuesFromStream]);
  });
  return extractedValues;
}

function getStreamValues(streamKey: StreamKey): RedisStreamEntry[] | void {
  if (!streamDB[streamKey]) return;
  return streamDB[streamKey];
}

function processXreadBlock$(
  streamKeys: StreamKey[],
  ids: Id[],
  textArray: TextArray,
) {
  ids.forEach((id, index, idsArray) => {
    if (id == "$") {
      const dbStreamValues = getStreamValues(streamKeys[index]);
      if (!dbStreamValues) return;
      idsArray[index] = dbStreamValues.slice(-1)[0].id;
      const indexOf$ = textArray.indexOf("$");
      textArray[indexOf$] = idsArray[index];
      return;
    }
  });
}

function getStreamKeysAndIds(
  textArray: TextArray,
  numberOfStreamKeys: number,
): StreamKeyIds {
  const streamKeys: StreamKey[] = textArray.slice(0, numberOfStreamKeys);
  const ids: string[] = textArray.slice(numberOfStreamKeys, textArray.length);
  if (textArray.includes("$")) processXreadBlock$(streamKeys, ids, textArray);
  return {
    streamKeys,
    ids,
  };
}

async function processStreamRangeExclusiveAsync(
  numberOfStreamKeys: number,
  textArray: TextArray,
  msBlockTime: number,
): Promise<StreamReadData | void> {
  const existingValues = processStreamRangeExclusive(
    numberOfStreamKeys,
    textArray,
  );
  if (existingValues.length > 0) return existingValues;
  if (msBlockTime === 0) msBlockTime = Infinity;
  const timeLimit = Date.now() + msBlockTime;

  const newInputedValue = new Promise<StreamReadData | void>((resolve) => {
    const timer = setInterval(() => {
      const newInputedValue = processStreamRangeExclusive(
        numberOfStreamKeys,
        textArray,
      );
      if (newInputedValue.length > 0) {
        clearInterval(timer);
        resolve(newInputedValue);
      }

      if (Date.now() >= timeLimit) {
        clearInterval(timer);
        resolve();
      }
    }, 10);
  });

  return newInputedValue;
}
