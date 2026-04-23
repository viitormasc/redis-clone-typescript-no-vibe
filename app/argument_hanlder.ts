import { handShake } from "./hanshake";
import { SERVER_CONFIG, type ServerInfo } from "./server_config";

export type Argument = "--port" | "--replicaof";

export let PORT: number = 6379;

export const ALL_SERVERS: ServerInfo[] = [];

export async function processAllArguments() {
  ALL_SERVERS.push(SERVER_CONFIG);
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

async function processCommand(argument: Argument, parameter: string): void {
  switch (argument) {
    case "--port":
      return proccessPort(parameter);
    case "--replicaof":
      return await processReplica(parameter);
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

async function processReplica(masterServer: string): Promise<void> {
  masterServer = masterServer.slice(0, masterServer.length);
  const masterPort = +masterServer.split(" ")[1];
  const masterHost = masterServer.split(" ")[0];
  SERVER_CONFIG.masterPort = masterPort;
  SERVER_CONFIG.role = "slave";
  try {
    await handShake(masterHost, masterPort);
  } catch (error) {
    throw new Error("Replica handshake could not succeed");
  }
  return;
}
