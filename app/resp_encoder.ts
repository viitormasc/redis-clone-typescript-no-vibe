import { type RedisStreamDBArguments } from "./db";

const DIVISOR = "\r\n";

export function arrayToRespArray(array: string[]): string {
  const arrayLength = array.length;
  if (arrayLength == 0) return "*0\r\n";
  let response = `*${arrayLength}${DIVISOR}`;
  array.forEach((value) => {
    response += `$${value.length}${DIVISOR}${value}${DIVISOR}`;
  });
  return response;
}

export function arrayToRestBulkString(textArray: string[]) {
  if (textArray.length == 0) return "$0\r\n\r\n";
  const length = textArray[0].length;
  textArray.unshift(`$${length}`);
  const response = textArray.join(DIVISOR).concat(DIVISOR);
  return response;
}

export function getNullArray() {
  return "*-1\r\n";
}

export function getNullBulkString() {
  return `$-1${DIVISOR}`;
}

export function integerToResp(integer: number) {
  const int32Val = integer | 0;
  if (!Number.isInteger(int32Val)) throw new Error("Value should be Int32");
  const respInteger = `:${integer}${DIVISOR}`;
  return respInteger;
}

export function simpleError(message: string) {
  return `-${message}${DIVISOR}`;
}

export function stringToBulkString(str: string) {
  const length = str.length;
  let bulkString = `$${length}${DIVISOR}`;
  bulkString = bulkString + str + DIVISOR;
  return bulkString;
}

export function stringToSimpleResp(word: string) {
  return `+${word}${DIVISOR}`;
}

export function xRangeStreamArrayToRespArray(
  streamArray: RedisStreamDBArguments[],
): string {
  let response = `*${streamArray.length}${DIVISOR}`;

  streamArray.forEach((streamItem) => {
    const { id, ...fields } = streamItem;
    const fieldEntries = Object.entries(fields);

    response += `*2${DIVISOR}`;
    response += `$${id.length}${DIVISOR}${id}${DIVISOR}`;

    response += `*${fieldEntries.length * 2}${DIVISOR}`;
    fieldEntries.forEach(([key, value]) => {
      response += `$${key.length}${DIVISOR}${key}${DIVISOR}`;
      response += `$${value.length}${DIVISOR}${value}${DIVISOR}`;
    });
  });

  return response;
}

export function xReadStreamArrayToRespArray(
  streamArray: [string, RedisStreamDBArguments[]] | void,
): string {
  if (!streamArray) return getNullArray();

  const [streamKey, entries] = streamArray;

  let response = `*1${DIVISOR}`;
  response += `*2${DIVISOR}`;
  response += `$${streamKey.length}${DIVISOR}${streamKey}${DIVISOR}`;
  response += `*${entries.length}${DIVISOR}`;

  entries.forEach((entry) => {
    const { id, ...fields } = entry;
    const fieldEntries = Object.entries(fields);

    response += `*2${DIVISOR}`;
    response += `$${id.length}${DIVISOR}${id}${DIVISOR}`;
    response += `*${fieldEntries.length * 2}${DIVISOR}`;

    fieldEntries.forEach(([key, value]) => {
      response += `$${key.length}${DIVISOR}${key}${DIVISOR}`;
      response += `$${value.length}${DIVISOR}${value}${DIVISOR}`;
    });
  });

  return response;
}
