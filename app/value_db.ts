import { parseFloatArgument, parseIntegerArgument } from "./command_parsers";
import {
  dbValueToArray,
  isKeyValueExpired,
  popListValue,
  setKeyValueWithPx,
  setSimpleKeyValue,
  valuesDB,
  type RedisList,
  type RedisValue,
  type StringError,
  type TextArray,
} from "./db_store";

export function setKeyValue(textArray: TextArray): boolean {
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

export function getKeyValue(textArray: TextArray): RedisList | null {
  const key = textArray[0];
  const isKeyExpired = !valuesDB[key] || isKeyValueExpired(key);
  if (isKeyExpired) return null;
  const value = valuesDB[key].value;
  return value;
}

export function addKeyListValue(textArray: TextArray): number | null {
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

export function getKeyListRangeValues(textArray: TextArray): RedisList {
  let key = textArray[0];
  let start = parseIntegerArgument(textArray[1]);
  let stop = parseIntegerArgument(textArray[2]);
  const isKeyExpired = !valuesDB[key] || isKeyValueExpired(key);
  if (isKeyExpired) return [];
  const dbValue = valuesDB[key].value;
  const valuesLength = dbValue.length;
  let listResponse: RedisList | RedisValue;
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

export function pushListValues(textArray: TextArray): number {
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

export function removeArrayValues(
  textArray: TextArray,
): RedisValue | RedisList {
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
  if (Number.isNaN(parseIntegerArgument(value[0]))) {
    return "ERR value is not an integer or out of range";
  }

  let valueInteger = parseIntegerArgument(value[0]) + 1;
  setSimpleKeyValue(textArray[0], valueInteger.toString());
  return valueInteger;
}
