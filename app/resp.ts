import { getKeyValue, setKeyValue } from "./db";

const DIVISOR = "\r\n";

export function restArrayToRestResponse(buffer: NonSharedBuffer): string {
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
      const retrievedValue = getKeyValue(textArray);
      if (!retrievedValue) {
        respResponse = getNullBulkString();
        break;
      }
      respResponse = arrayToRestBulkString([retrievedValue]);
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
