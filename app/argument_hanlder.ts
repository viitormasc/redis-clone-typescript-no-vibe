import * as net from "net";

import { SERVER_CONFIG } from "./server_config";
import { commandToRespArray } from "./resp_encoder";

export type Argument = "--port" | "--replicaof";

export let PORT: number = 6379;

export function processAllArguments() {
  const args = process.argv;
  for (let arg of args) {
    const sufix = arg.substring(0, 2);
    if (sufix == "--") {
      const parameterIndex = args.indexOf(arg) + 1;
      const parameter = args[parameterIndex];
      processCommand(arg as Argument, parameter);
    }
  }
}

function processCommand(argument: Argument, parameter: string): void {
  switch (argument) {
    case "--port":
      return proccessPort(parameter);
    case "--replicaof":
      return processReplica(parameter);
    default:
      break;
  }
}

function proccessPort(customPort: string): void {
  PORT = parseInt(customPort);
  console.log("PORT", PORT);
  if (Number.isNaN(PORT)) PORT = 6379;
  SERVER_CONFIG.port = PORT;
  return;
}

async function sendCommandToMaster(
  host: string,
  port: number,
  command: string[],
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(commandToRespArray(command));
    });

    socket.once("data", (data) => {
      console.log("data", data.toString());
      resolve(data.toString("utf8"));
      socket.end();
    });

    socket.once("error", reject);
  });
}

async function handShake(masterHost: string, masterPort: number) {
  const response = await sendCommandToMaster(masterHost, masterPort, ["PING"]);
  if (response !== "+PONG\r\n") {
    throw new Error(`Unexpected master response: ${response}`);
  }
  return;
}

async function processReplica(masterServer: string): Promise<void> {
  masterServer = masterServer.slice(0, masterServer.length);
  const masterPort = +masterServer.split(" ")[1];
  console.log("masterPort", masterPort);
  const masterHost = masterServer.split(" ")[0];
  console.log("masterHost", masterHost);
  SERVER_CONFIG.masterPort = masterPort;
  SERVER_CONFIG.role = "slave";
  try {
    await handShake(masterHost, masterPort);
  } catch (error) {
    throw new Error("Replica handshake could not succeed");
  }
  return;
}
