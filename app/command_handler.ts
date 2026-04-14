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
import { type CommandResult } from "./command_result";
import { incrementValue, openMultiConnection } from "./value_db";

export async function handleCommand(
  messageArray: string[],
): Promise<CommandResult> {
  const command = messageArray[0].toLowerCase();
  const textArray = messageArray.slice(1);

  switch (command) {
    case "echo":
      return { type: "bulk", value: textArray[0] ?? "" };
    case "ping":
      return { type: "simple", value: "PONG" };
    case "set":
      const valueWasSet = setKeyValue(textArray);
      if (!valueWasSet) {
        throw new Error("Value was not set");
      }
      return { type: "simple", value: "OK" };
    case "get":
      let retrievedValue = getKeyValue(textArray);
      if (!retrievedValue) {
        return { type: "bulk_null" };
      }
      if (!Array.isArray(retrievedValue)) {
        retrievedValue = [retrievedValue];
      }
      return { type: "bulk", value: retrievedValue[0] };
    case "rpush":
      const newListLength = addKeyListValue(textArray);
      if (!newListLength) {
        return { type: "bulk_null" };
      }
      return { type: "integer", value: newListLength };
    case "lrange":
      return { type: "array", value: getKeyListRangeValues(textArray) };
    case "lpush":
      return { type: "integer", value: pushListValues(textArray) };
    case "llen":
      return { type: "integer", value: getListLength(textArray) };
    case "lpop":
      const removedArrayValues = removeArrayValues(textArray);
      if (!removedArrayValues) {
        return { type: "bulk_null" };
      }
      return Array.isArray(removedArrayValues)
        ? { type: "array", value: removedArrayValues }
        : { type: "bulk", value: removedArrayValues };
    case "blpop":
      const blpopValue = await getBlockedPop(textArray);
      if (!blpopValue) {
        return { type: "array_null" };
      }
      return { type: "array", value: [textArray[0], blpopValue] };
    case "type":
      return { type: "simple", value: getValueType(textArray) };
    case "xadd":
      const streamId = addStreamValues(textArray);
      if (typeof streamId !== "string" && streamId.error) {
        return { type: "error", value: streamId.message };
      }
      return { type: "bulk", value: streamId as string };
    case "xrange":
      const inclusiveStream = getStreamRangeInclusive(textArray);
      if (!inclusiveStream) {
        return { type: "array_null" };
      }
      return { type: "stream_range", value: inclusiveStream };
    case "xread":
      return {
        type: "stream_read",
        value: await getStreamRangeExclusive(textArray),
      };
    case "incr":
      const incrementedValue = incrementValue(textArray);
      return typeof incrementedValue == "number"
        ? {
            type: "integer",
            value: incrementedValue,
          }
        : {
            type: "error",
            value: incrementedValue,
          };
    case "multi":
      return {
        type: "simple",
        value: openMultiConnection(),
      };
    default:
      return { type: "raw", value: "" };
  }
}
