import * as net from "net";
import { commandToRespArray } from "./resp_encoder";
import type { ConnectionUUID, TextArray } from "./db_store";
import { SERVER_CONFIG } from "./server_config";
import type { CommandResult } from "./command_result";

const emptyRdbFile =
  "UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog==";

async function sendCommandToMaster(
  socket: net.Socket,
  command: string[],
): Promise<string> {
  const response = await new Promise<string>((resolve, reject) => {
    socket.write(commandToRespArray(command));
    socket.once("data", (data) => {
      console.log("data", data.toString());
      resolve(data.toString("utf8"));
    });
    socket.once("error", reject);
  });
  return response;
}

export async function handShake(masterHost: string, masterPort: number) {
  const masterSocket: net.Socket = net.createConnection({
    host: masterHost,
    port: masterPort,
  });
  const pingResponse = await sendCommandToMaster(masterSocket, ["PING"]);

  if (pingResponse !== "+PONG\r\n") {
    masterSocket.end();
    throw new Error(`Unexpected master response: ${pingResponse}`);
  }
  const firstReplConf = await sendCommandToMaster(
    masterSocket,
    `REPLCONF listening-port ${SERVER_CONFIG.port}`.split(" "),
  );
  if (firstReplConf !== "+OK\r\n") {
    masterSocket.end();
    throw new Error(`Unexpected master response: ${pingResponse}`);
  }
  const secondReplConf = await sendCommandToMaster(
    masterSocket,
    "REPLCONF capa psync2".split(" "),
  );
  if (secondReplConf !== "+OK\r\n") {
    masterSocket.end();
    throw new Error(`Unexpected master response: ${pingResponse}`);
  }

  const psyncResponse = await sendCommandToMaster(
    masterSocket,
    "PSYNC ? -1".split(" "),
  );

  masterSocket.end();
  return;
}

export function handleReplConf(textArray: TextArray): string {
  return "OK";
}

export async function handlePsync(
  textArray: TextArray,
  connectionUUID: ConnectionUUID,
): Promise<CommandResult> {
  const buffer = Buffer.from(emptyRdbFile);
  const rdbLength = buffer.length;

  return {
    type: "multi_response",
    value: [
      {
        type: "simple",
        value: `FULLRESYNC ${SERVER_CONFIG.masterRepliId} 0`,
      },
      {
        type: "rdb",
        value: { rdbLength: rdbLength, rdbContent: emptyRdbFile },
      },
    ],
  };
}
