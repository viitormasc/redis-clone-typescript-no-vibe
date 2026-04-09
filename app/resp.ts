import { commandToResp } from "./command_handler";
import { parseRespCommand } from "./resp_parser";

export async function restArrayToRestResponse(
  buffer: NonSharedBuffer | string,
): Promise<string> {
  const { respArrayText, messageArray } = parseRespCommand(buffer);
  console.log("respArrayText", respArrayText);
  console.log("messageArray", messageArray);
  return commandToResp(messageArray);
}
