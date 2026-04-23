import * as net from "net";
import { commandToRespArray } from "./resp_encoder";
import type { TextArray } from "./db_store";
import { SERVER_CONFIG } from "./server_config";
import { ALL_SERVERS } from "./argument_hanlder";

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

export function handlePsync(textArray: TextArray): string {
  return `FULLRESYNC ${SERVER_CONFIG.masterRepliId} 0`;
}
