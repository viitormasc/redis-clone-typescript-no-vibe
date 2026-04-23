import * as net from "net";
import { commandToRespArray } from "./resp_encoder";
import type { TextArray } from "./db_store";

async function sendCommandToMaster(
  host: string,
  port: number,
  command: string[],
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(commandToRespArray(command));
      console.log(
        "socket.write(commandToRespArray(command));",
        commandToRespArray(command),
      );
    });

    socket.once("data", (data) => {
      console.log("data", data.toString());
      resolve(data.toString("utf8"));
      socket.end();
    });

    socket.once("error", reject);
  });
}

export async function handShake(masterHost: string, masterPort: number) {
  const pingResponse = await sendCommandToMaster(masterHost, masterPort, [
    "PING",
  ]);
  if (pingResponse !== "+PONG\r\n") {
    throw new Error(`Unexpected master response: ${pingResponse}`);
  }
  const firstReplConf = await sendCommandToMaster(
    masterHost,
    masterPort,
    "REPLCONF listening-port 6969".split(" "),
  );
  if (firstReplConf !== "+OK\r\n") {
    throw new Error(`Unexpected master response: ${pingResponse}`);
  }
  const secondReplConf = await sendCommandToMaster(
    masterHost,
    masterPort,
    "REPLCONF capa psync2".split(" "),
  );
  if (secondReplConf !== "+OK\r\n") {
    throw new Error(`Unexpected master response: ${pingResponse}`);
  }

  return;
}

export function handleReplConf(textArray: TextArray): string {
  console.log("running replconft");
  return "OK";
}
