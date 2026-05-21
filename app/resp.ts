import type { UUID } from "crypto";
import * as net from "net";
import { processCommand } from "./command_handler";
import { type CommandResult } from "./command_result";
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
import { parseRespCommand } from "./resp_parser";

export async function processSocketCommand(
  buffer: NonSharedBuffer | string,
  connectionUUID: UUID,
  connection: net.Socket,
): Promise<Array<string | Buffer>> {
  const { messageArray } = parseRespCommand(buffer);
  console.log("messageArray", messageArray);
  const result = await processCommand(messageArray, connectionUUID, connection);
  return encodeCommandResultChunks(result);
}

const encodeFunctions = {
  simple: stringToSimpleResp,
  bulk: stringToBulkString,
  bulk_null: getNullBulkString,
  integer: integerToResp,
  array: arrayToRespArray,
  array_null: getNullArray,
  exec: encodeExecResult,
  stream_range: xRangeStreamArrayToRespArray,
  stream_read: xReadStreamArrayToRespArray,
  error: simpleError,
  raw: (value) => value,
  rdb: stringRdbToRespRdb,
  multi_response: (value) =>
    Buffer.concat(
      encodeMultiResponse(value).map((response) =>
        typeof response === "string" ? Buffer.from(response) : response,
      ),
    ),
};
export function encodeCommandResult(result: CommandResult): string | Buffer {
  const func = encodeFunctions[result.type];
  if (!func) {
    throw new Error(`Unknown type: ${result.type}`);
  }

  return func(result.value);

  // switch (result.type) {
  //   case "simple":
  //     return stringToSimpleResp(result.value);
  //   case "bulk":
  //     return stringToBulkString(result.value);
  //   case "bulk_null":
  //     return getNullBulkString();
  //   case "integer":
  //     return integerToResp(result.value);
  //   case "array":
  //     return arrayToRespArray(result.value);
  //   case "array_null":
  //     return getNullArray();
  //   case "exec":
  //     return encodeExecResult(result.value);
  //   case "stream_range":
  //     return xRangeStreamArrayToRespArray(result.value);
  //   case "stream_read":
  //     return xReadStreamArrayToRespArray(result.value);
  //   case "error":
  //     return simpleError(result.value);
  //   case "raw":
  //     return result.value;
  //   case "rdb":
  //     return stringRdbToRespRdb(result.value);
  //   case "multi_response":
  //     return Buffer.concat(
  //       encodeMultiResponse(result.value).map((response) =>
  //         typeof response === "string" ? Buffer.from(response) : response,
  //       ),
  //     );
  // }
}

export function encodeCommandResultChunks(
  result: CommandResult,
): Array<string | Buffer> {
  if (result.type === "multi_response") {
    return encodeMultiResponse(result.value);
  }

  return [encodeCommandResult(result)];
}

function encodeExecResult(results: CommandResult[]): string {
  let response = `*${results.length}\r\n`;

  results.forEach((result) => {
    const encodedResult = encodeCommandResult(result);
    response +=
      typeof encodedResult === "string"
        ? encodedResult
        : encodedResult.toString("binary");
  });

  return response;
}

function encodeMultiResponse(results: CommandResult[]): Array<string | Buffer> {
  return results.flatMap((result) => encodeCommandResultChunks(result));
}
