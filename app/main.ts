import * as net from "net";
import { restArrayToRestResponse } from "./resp";
import { randomUUID } from "crypto";
import { deleteTransaction } from "./transaction_store";
import { PORT, processAllArguments } from "./argument_hanlder";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");
// Uncomment the code below to pass the first stage
processAllArguments();
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
