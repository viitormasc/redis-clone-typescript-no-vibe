import { SERVER_CONFIG } from "./server_config";
import { getOrCreateTransaction } from "./transaction_store";

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

function processReplica(masterServer: string): void {
  masterServer = masterServer.slice(1, masterServer.length);
  const masterPort = +masterServer.split(" ")[1];
  SERVER_CONFIG.port = masterPort;
  SERVER_CONFIG.role = "slave";
  return;
}
