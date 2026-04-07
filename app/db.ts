import { randomUUIDv7 } from "bun";
import { number } from "zod";

type Key = string;

interface RedisDBArguments {
  id: string;
  value: string[];
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
    value: [value],
    timestampAdded: Date.now(),
    expiresInMs: Infinity,
  };
  return;
}

function setKeyValueWithPx(key: string, value: string, timeMs: number) {
  db[key] = {
    id: randomUUIDv7(),
    value: [value],
    timestampAdded: Date.now(),
    expiresInMs: timeMs,
  };
}

export function getKeyValue(textArray: string[]): string | null | string[] {
  const key = textArray[0];
  const isKeyExpired = !db[key] || isKeyValueExpired(key) 
  if (isKeyExpired) return null;
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
  const isKeyExpired = !db[key] || isKeyValueExpired(key) 

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
  const isKeyExpired = !db[key] || isKeyValueExpired(key) 
  if (isKeyExpired) return [];
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
  const isKeyExpired = !db[key] || isKeyValueExpired(key) 
  if (isKeyExpired) {
    const firstValue = values.shift();
    setSimpleKeyValue(key, firstValue!!);
    if (values.length == 0) return 1;
  }
  const dbValue = dbValueToArray(key);

  values.forEach((value) => {
    dbValue.unshift(value);
  });

  db[key].value = dbValue;
  return db[key].value.length;
}

export function getListLength(textArray: string[]): number {
  const key = textArray[0];
  const isKeyExpired = !db[key] || isKeyValueExpired(key) 
  if (isKeyExpired) return 0;

  return db[key].value.length;
}

export function removeArrayValues(textArray: string[]): string | string[] {
  const key = textArray[0];
  const isKeyExpired = !db[key] || isKeyValueExpired(key) 
  const numberOfValues = Number.parseInt(textArray[1]);
  if (isKeyExpired) return "";
  if (!numberOfValues || typeof db[key].value == "string") {
    const firstValue =
      typeof db[key].value == "string" ? db[key].value : db[key].value.shift();

    return firstValue || "";
  } else if (Number.isNaN(numberOfValues) && Array.isArray(db[key].value)) {
    const namedValue = textArray[1];
    db[key].value = db[key].value.filter((value) => value !== namedValue);
    return namedValue;
  }
  return db[key].value.splice(0, numberOfValues);
}

function dbValueToArray(key: string): string[] {
  const dbValue = !Array.isArray(db[key].value)
    ? [db[key].value]
    : db[key].value;

  return dbValue;
}


export async function getBlockedPop(textArray: string[]): Promise<string>{
  const key = textArray[0]
  const timeoutInSec = parseFloat(textArray[1])
console.log("timeoutInSec", timeoutInSec)

  if (!key || Number.isNaN(timeoutInSec)) throw new Error("Blpop command must have list key and timeout in seconds")
  let poppedValue : string
  if(!db[key]) {
    poppedValue  = await popListValueAsync(key, timeoutInSec)
    return poppedValue 
  }
  poppedValue = popListValue(key) as string
return poppedValue
}

function popListValueAsync(key: string,  timeoutInSec : number){
  let now = Date.now()
  const timeoutInMs = timeoutInSec * 1000 || Infinity
  const timeLimit = now + timeoutInMs 
  return new Promise<string>((resolve, reject) => {
    setInterval(() => {
     const removedValue = popListValue(key) 
      // now = now + 1
      if(Date.now() >= timeLimit) {
        resolve("")
      }
      if(removedValue && Date.now() <= timeLimit) {
        resolve(removedValue)
      }
      else if (removedValue && Date.now() > timeLimit){
        resolve("")
      }
    }, 1)
  })
}


function popListValue(key: string) {
  const keyExists = db[key]
  if (!keyExists) return ""
    return db[key].value.shift()
}

export function getValueType(textArray:string[]) : string {
  const key = textArray[0]
  const isKeyExpired = !db[key] || isKeyValueExpired(key) 
  if (isKeyExpired) return "none"
  const dbValue = db[key].value 
  if(dbValue.length == 1) return "string"

return "none"
}
