import type { RdbResponse } from "./command_result";
import { type RedisStreamEntry } from "./db";
import type { StreamReadData } from "./db_store";

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
  streamArray: RedisStreamEntry[],
): string {
  let response = `*${streamArray.length}${DIVISOR}`;

  streamArray.forEach((streamItem) => {
    const fieldEntries = Object.entries(streamItem.values);

    response += `*2${DIVISOR}`;
    response += `$${streamItem.id.length}${DIVISOR}${streamItem.id}${DIVISOR}`;

    response += `*${fieldEntries.length * 2}${DIVISOR}`;
    fieldEntries.forEach(([key, value]) => {
      response += `$${key.length}${DIVISOR}${key}${DIVISOR}`;
      response += `$${value.length}${DIVISOR}${value}${DIVISOR}`;
    });
  });

  return response;
}

export function xReadStreamArrayToRespArray(
  streamDataArray: StreamReadData | void,
): string {
  if (!streamDataArray) return getNullArray();
  let response = `*${streamDataArray.length}${DIVISOR}`;
  streamDataArray.forEach(([streamKey, entries]) => {
    response += `*2${DIVISOR}`;
    response += `$${streamKey.length}${DIVISOR}${streamKey}${DIVISOR}`;
    response += `*${entries.length}${DIVISOR}`;

    entries.forEach((entry) => {
      const fieldEntries = Object.entries(entry.values);

      response += `*2${DIVISOR}`;
      response += `$${entry.id.length}${DIVISOR}${entry.id}${DIVISOR}`;
      response += `*${fieldEntries.length * 2}${DIVISOR}`;

      fieldEntries.forEach(([key, value]) => {
        response += `$${key.length}${DIVISOR}${key}${DIVISOR}`;
        response += `$${value.length}${DIVISOR}${value}${DIVISOR}`;
      });
    });
  });

  return response;
}

export function commandToRespArray(parts: string[]): string {
  let response = `*${parts.length}\r\n`;
  for (const part of parts) {
    response += `$${part.length}\r\n${part}\r\n`;
  }
  return response;
}

export function stringRdbToRespRdb(value: RdbResponse): string {
  return `$${value.rdbLength}\r\n${value.rdbContent}`;
}
