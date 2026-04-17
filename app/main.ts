import * as net from "net";
import { restArrayToRestResponse } from "./resp";
import { randomUUID } from "crypto";
import { deleteTransaction } from "./transaction_store";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");
const PORT = proccessPort();
// Uncomment the code below to pass the first stage
const server: net.Server = net.createServer((connection: net.Socket) => {
  //   // Handle connection

  const connectionUUID = randomUUID();
  connection.on("data", async (command) => {
    const respReponse = await restArrayToRestResponse(command, connectionUUID);
    connection.write(respReponse);
  });

  connection.on("close", (hadError) => {
    deleteTransaction(connectionUUID);
  });
});
//
server.listen(PORT, "127.0.0.1");

function proccessPort() {
  const args = process.argv;
  const portIndex = args.indexOf("--port");
  const PORT = portIndex !== -1 ? parseInt(args[portIndex + 1]) : 6379;
  return PORT;
}
