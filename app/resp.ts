import { handleCommand } from "./command_handler";
import { type CommandResult } from "./command_result";
import { parseRespCommand } from "./resp_parser";
import {
  arrayToRespArray,
  getNullArray,
  getNullBulkString,
  integerToResp,
  simpleError,
  stringToBulkString,
  stringToSimpleResp,
  xRangeStreamArrayToRespArray,
  xReadStreamArrayToRespArray,
} from "./resp_encoder";
import type { UUID } from "crypto";

export async function restArrayToRestResponse(
  buffer: NonSharedBuffer | string,
  connectionUUID: UUID,
): Promise<string> {
  const { respArrayText, messageArray } = parseRespCommand(buffer);
  console.log("respArrayText", respArrayText);
  console.log("messageArray", messageArray);
  const result = await handleCommand(messageArray, connectionUUID);
  return result;
}

export function encodeCommandResult(result: CommandResult): string {
  switch (result.type) {
    case "simple":
      return stringToSimpleResp(result.value);
    case "bulk":
      return stringToBulkString(result.value);
    case "bulk_null":
      return getNullBulkString();
    case "integer":
      return integerToResp(result.value);
    case "array":
      return arrayToRespArray(result.value);
    case "array_null":
      return getNullArray();
    case "exec":
      return encodeExecResult(result.value);
    case "stream_range":
      return xRangeStreamArrayToRespArray(result.value);
    case "stream_read":
      return xReadStreamArrayToRespArray(result.value);
    case "error":
      return simpleError(result.value);
    case "raw":
      return result.value;
  }
}

function encodeExecResult(results: CommandResult[]): string {
  let response = `*${results.length}\r\n`;

  results.forEach((result) => {
    response += encodeCommandResult(result);
  });

  return response;
}
