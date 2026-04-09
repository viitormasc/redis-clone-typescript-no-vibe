import {
  addKeyListValue,
  addStreamValues,
  getBlockedPop,
  getKeyListRangeValues,
  getKeyValue,
  getListLength,
  getStreamRangeExclusive,
  getStreamRangeInclusive,
  getValueType,
  pushListValues,
  removeArrayValues,
  setKeyValue,
} from "./db";
import {
  arrayToRespArray,
  arrayToRestBulkString,
  getNullArray,
  getNullBulkString,
  integerToResp,
  simpleError,
  stringToBulkString,
  stringToSimpleResp,
  xRangeStreamArrayToRespArray,
  xReadStreamArrayToRespArray,
} from "./resp_encoder";

export async function commandToResp(messageArray: string[]): Promise<string> {
  const command = messageArray[0].toLowerCase();
  const textArray = messageArray.slice(1);

  switch (command) {
    case "echo":
      return arrayToRestBulkString(textArray);
    case "ping":
      return stringToSimpleResp("PONG");
    case "set":
      const valueWasSet = setKeyValue(textArray);
      if (!valueWasSet) {
        throw new Error("Value was not set");
      }
      return stringToSimpleResp("OK");
    case "get":
      let retrievedValue = getKeyValue(textArray);
      if (!retrievedValue) {
        return getNullBulkString();
      }
      if (!Array.isArray(retrievedValue)) {
        retrievedValue = [retrievedValue];
      }
      return arrayToRestBulkString(retrievedValue);
    case "rpush":
      const newListLength = addKeyListValue(textArray);
      if (!newListLength) {
        return getNullBulkString();
      }
      return integerToResp(newListLength);
    case "lrange":
      return arrayToRespArray(getKeyListRangeValues(textArray));
    case "lpush":
      return integerToResp(pushListValues(textArray));
    case "llen":
      return integerToResp(getListLength(textArray));
    case "lpop":
      const removedArrayValues = removeArrayValues(textArray);
      if (!removedArrayValues) {
        return getNullBulkString();
      }
      return Array.isArray(removedArrayValues)
        ? arrayToRespArray(removedArrayValues)
        : arrayToRestBulkString([removedArrayValues]);
    case "blpop":
      const blpopValue = await getBlockedPop(textArray);
      if (!blpopValue) {
        return getNullArray();
      }
      return arrayToRespArray([textArray[0], blpopValue]);
    case "type":
      return stringToSimpleResp(getValueType(textArray));
    case "xadd":
      const streamId = addStreamValues(textArray);
      if (typeof streamId !== "string" && streamId.error) {
        return simpleError(streamId.message);
      }
      return stringToBulkString(streamId as string);
    case "xrange":
      const inclusiveStream = getStreamRangeInclusive(textArray);
      if (!inclusiveStream) {
        return getNullArray();
      }
      return xRangeStreamArrayToRespArray(inclusiveStream);
    case "xread":
      return xReadStreamArrayToRespArray(getStreamRangeExclusive(textArray));
    default:
      return "";
  }
}
