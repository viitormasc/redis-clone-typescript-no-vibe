import { handleCommand } from "./command_handler";
import { type CommandResult } from "./command_result";
import { parseRespCommand } from "./resp_parser";
import {
  arrayToRespArray,
  getNullArray,
  getNullBulkString,
  integerToResp,
  simpleError,
  stringRdbToRespRdb,
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
  console.log("messageArray", messageArray);
  const result = await handleCommand(messageArray, connectionUUID);
  return result;
}

export async function restArrayToRestResponses(
  buffer: NonSharedBuffer | string,
  connectionUUID: UUID,
): Promise<string[]> {
  const { messageArray } = parseRespCommand(buffer);
  console.log("messageArray", messageArray);
  const response = await handleCommand(messageArray, connectionUUID);
  return Array.isArray(response) ? response : [response];
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
    case "rdb":
      return stringRdbToRespRdb(result.value);
    case "multi_response":
      return encodeMultiResponse(result.value).join("");
  }
}

export function encodeCommandResultChunks(result: CommandResult): string[] {
  if (result.type === "multi_response") {
    return encodeMultiResponse(result.value);
  }

  return [encodeCommandResult(result)];
}

function encodeExecResult(results: CommandResult[]): string {
  let response = `*${results.length}\r\n`;

  results.forEach((result) => {
    response += encodeCommandResult(result);
  });

  return response;
}

function encodeMultiResponse(results: CommandResult[]): string[] {
  return results.flatMap((result) => encodeCommandResultChunks(result));
}
