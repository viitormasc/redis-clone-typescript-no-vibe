import {
  addKeyListValue,
  getBlockedPop,
  getFirstValue,
  getKeyListRangeValues,
  getKeyValue,
  getListLength,
  pushListValues,
  removeAndReturnValues,
  removeArrayValues,
  setKeyValue,
} from "./db";

const DIVISOR = "\r\n";

export async function restArrayToRestResponse(
  buffer: NonSharedBuffer | string,
): Promise<string> {
  const respArrayText = buffer.toString("utf8");
  console.log("respArrayText", respArrayText);
  const propperRestArray = respArrayText.substring(1).split(DIVISOR);
  const numberOfElements = propperRestArray.shift();
  const messageArray = propperRestArray.filter(
    (value, index) => index % 2 !== 0,
  );

  console.log("messageArray", messageArray);
  const command = messageArray[0].toLowerCase();
  const textArray = messageArray.slice(1);
  let response: string[] = [];
  let respResponse: string = "";
  switch (command) {
    case "echo":
      response = runEchoCommand(textArray);
      respResponse = arrayToRestBulkString(response);
      break;
    case "ping":
      respResponse = stringToSimpleResp("PONG");
      break;
    case "set":
      const valueWasSet = setKeyValue(textArray);
      if (!valueWasSet) {
        throw new Error("Value was not set");
      }
      respResponse = stringToSimpleResp("OK");
      break;
    case "get":
      let retrievedValue = getKeyValue(textArray);
      if (!retrievedValue) {
        respResponse = getNullBulkString();
        break;
      }
      if (!Array.isArray(retrievedValue)) {
        retrievedValue = [retrievedValue];
      }
      respResponse = arrayToRestBulkString(retrievedValue);
      break;
    case "rpush":
      const newListLength = addKeyListValue(textArray);
      if (!newListLength) {
        respResponse = getNullBulkString();
        break;
      }
      respResponse = integerToResp(newListLength);
      break;
    case "lrange":
      const listValues = getKeyListRangeValues(textArray);
      console.log("listValues", listValues);
      respResponse = arrayToRespArray(listValues);
      break;
    case "lpush":
      const newValuesLength = pushListValues(textArray);
      respResponse = integerToResp(newValuesLength);
      break;
    case "llen":
      const listLength = getListLength(textArray);
      respResponse = integerToResp(listLength);
      break;
    case "lpop":
      const removedArrayValues = removeArrayValues(textArray);
      const initialResponseTypeIsArray = Array.isArray(removedArrayValues)
        ? true
        : false;
      if (!removedArrayValues) {
        respResponse = getNullBulkString();
        break;
      }
      respResponse = initialResponseTypeIsArray
        ? arrayToRespArray(removedArrayValues as string[])
        : arrayToRestBulkString([removedArrayValues as string]);
      break;
    case "blpop":
      const blpopValue = await getBlockedPop(textArray)
      if(!blpopValue) {
        respResponse = returnNullArray() 
        break
      }
      respResponse = arrayToRespArray([textArray[0],blpopValue]);
      break;
  }
  return respResponse;
}

function runEchoCommand(textArray: string[]) {
  return textArray;
}

function arrayToRestBulkString(textArray: string[]) {
  if (textArray.length == 0) return "$0\r\n\r\n";
  const length = textArray[0].length;
  textArray.unshift(`$${length}`);
  const response = textArray.join(DIVISOR).concat(DIVISOR);
  return response;
}

function stringToSimpleResp(word: string) {
  return `+${word}${DIVISOR}`;
}

function getNullBulkString() {
  return `$-1${DIVISOR}`;
}

function integerToResp(integer: number) {
  const int32Val = integer | 0;
  if (!Number.isInteger(int32Val)) throw new Error("Value should be Int32");
  const respInteger = `:${integer}${DIVISOR}`;
  return respInteger;
}

function arrayToRespArray(array: string[]): string {
  const arrayLength = array.length;
  if (arrayLength == 0) return "*0\r\n";
  let response = `*${arrayLength}${DIVISOR}`;
  array.forEach((value, index, array) => {
    response += `$${value.length}${DIVISOR}${value}${DIVISOR}`;
  });
  return response;
}

function returnNullArray() {
  return "*-1\r\n"
}
