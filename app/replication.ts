import * as net from "net";
import { arrayToRespArray } from "./resp_encoder";
import { SERVER_CONFIG } from "./server_config";

const REPLICATED_COMMANDS = ["set", "rpush", "lpush", "xadd", "incr", "del"];
export let LAST_COMMANDS: string[] = ["", "", ""];

export function checkIfHandshakeIsComplete(
  connection: net.Socket,
  messageArray: string[],
) {
  LAST_COMMANDS.push(messageArray.join(" ").toLowerCase());
  LAST_COMMANDS = LAST_COMMANDS.slice(-3);
  console.log("lastCommands", LAST_COMMANDS);

  if (LAST_COMMANDS[0] !== "ping") {
    console.log("ping not match");
    return;
  }
  if (
    LAST_COMMANDS[1].split(" ")[0] !== "replconf" ||
    LAST_COMMANDS[1].split(" ")[1] !== "listening-port"
  ) {
    console.log("replconf listening-port not match");
    return;
  }
  if (LAST_COMMANDS[2] !== "replconf capa psync2") {
    console.log("capa psync2 not match");
    return;
  }
  addReplica(connection);
}

export function addReplica(connection: net.Socket) {
  console.log("Adding replica ", connection.remotePort);
  SERVER_CONFIG.replicas.push(connection);
}

export function replicateCommand(messageArray: string[]) {
  const command = messageArray[0].toLowerCase();
  if (
    !REPLICATED_COMMANDS.includes(command) ||
    SERVER_CONFIG.replicas.length == 0
  ) {
    return;
  }
  messageArray.push("no-response");
  const respMessage = arrayToRespArray(messageArray);
  console.log("respMessage", respMessage);
  for (let socket of SERVER_CONFIG.replicas) {
    console.log("Writing on socket", socket.remotePort);
    socket.write(respMessage);
  }
}
