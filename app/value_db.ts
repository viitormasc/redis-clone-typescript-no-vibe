import {
  dbValueToArray,
  isKeyValueExpired,
  popListValue,
  setKeyValueWithPx,
  setSimpleKeyValue,
  valuesDB,
  type Connection,
  type ResponseWithSucces,
  type StringError,
  type TextArray,
} from "./db_store";
import { parseFloatArgument, parseIntegerArgument } from "./command_parsers";
import { findAndExecCommand, QUEUE_COMMANDS } from "./command_handler";
import type { UUID } from "crypto";
import { type CommandResult } from "./command_result";

export let CONNECTION_INFO: Connection = {
  uuid: "c896ca37-fe03-42a1-bd16-215169186004",
  open: false,
};

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

export function getKeyValue(textArray: string[]): string | null | string[] {
  const key = textArray[0];
  const isKeyExpired = !valuesDB[key] || isKeyValueExpired(key);
  if (isKeyExpired) return null;
  const value = valuesDB[key].value;
  return value;
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
  let start = parseIntegerArgument(textArray[1]);
  let stop = parseIntegerArgument(textArray[2]);
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
  const numberOfValues = parseIntegerArgument(textArray[1]);
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

export async function getBlockedPop(textArray: string[]): Promise<string> {
  const key = textArray[0];
  const timeoutInSec = parseFloatArgument(textArray[1]);

  if (!key || Number.isNaN(timeoutInSec))
    throw new Error("Blpop command must have list key and timeout in seconds");

  const currentList = valuesDB[key]?.value;
  if (currentList && currentList.length > 0) {
    return popListValue(key) as string;
  }

  return popListValueAsync(key, timeoutInSec);
}

function popListValueAsync(key: string, timeoutInSec: number) {
  let now = Date.now();
  const timeoutInMs = timeoutInSec * 1000 || Infinity;
  const timeLimit = now + timeoutInMs;
  return new Promise<string>((resolve, reject) => {
    const interval = setInterval(() => {
      const removedValue = popListValue(key);
      if (Date.now() >= timeLimit) {
        clearInterval(interval);
        resolve("");
      }
      if (removedValue && Date.now() <= timeLimit) {
        clearInterval(interval);
        resolve(removedValue);
      } else if (removedValue && Date.now() > timeLimit) {
        clearInterval(interval);
        resolve("");
      }
    }, 1);
  });
}

export function getValueType(textArray: TextArray): string {
  const key = textArray[0];
  const isKeyExpired = !valuesDB[key] || isKeyValueExpired(key);
  if (isKeyExpired) {
    return "none";
  }
  const dbValue = valuesDB[key].value;
  if (dbValue.length == 1) return "string";

  return "none";
}

export function incrementValue(textArray: TextArray): number | StringError {
  let value = getKeyValue(textArray);
  if (!value) {
    setSimpleKeyValue(textArray[0], "1");
    return 1;
  }
  if (value.length > 1) {
    return "ERR value is not an integer or out of range";
  }
  if (Number.isNaN(parseInt(value as string))) {
    return "ERR value is not an integer or out of range";
  }

  let valueInteger = parseInt(value[0]) + 1;
  setSimpleKeyValue(textArray[0], valueInteger.toString());
  return valueInteger;
}

export function openMultiConnection(connectionUUID: UUID): string {
  CONNECTION_INFO = {
    uuid: connectionUUID,
    open: true,
  };
  return "OK";
}

export async function runQueuedCommands(): Promise<
  StringError | CommandResult[]
> {
  if (CONNECTION_INFO.open == false) {
    return "ERR EXEC without MULTI";
  }
  if (QUEUE_COMMANDS.length == 0) {
    CONNECTION_INFO.open = false;
    return [];
  }

  const responses: CommandResult[] = [];
  while (QUEUE_COMMANDS.length) {
    const fullCommand = QUEUE_COMMANDS.shift()!!;
    const response = await findAndExecCommand(
      fullCommand.command,
      fullCommand.textArray,
      CONNECTION_INFO.uuid,
    );
    responses.push(response);
  }
  CONNECTION_INFO.open = false;
  return responses;
}

export function discardQueueCommands(): ResponseWithSucces {
  if (CONNECTION_INFO.open == false) {
    return {
      success: false,
      message: "ERR DISCARD without MULTI",
    };
  }
  CONNECTION_INFO.open = false;
  QUEUE_COMMANDS.length = 0;
  return {
    success: true,
    message: "OK",
  };
}
