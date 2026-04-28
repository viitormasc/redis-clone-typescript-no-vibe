import * as net from "net";
import { randomUUID } from "crypto";
import { deleteTransaction } from "./transaction_store";
import { PORT, processAllArguments } from "./argument_hanlder";
import { processSocketCommand } from "./resp";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");
// Uncomment the code below to pass the first stage
processAllArguments();

const server: net.Server = net.createServer((connection: net.Socket) => {
  //   // Handle connection
  const connectionUUID = randomUUID();

  connection.on("data", async (command) => {
    console.log("(command)", command);
    const respResponses = await processSocketCommand(
      command,
      connectionUUID,
      connection,
    );
    respResponses.forEach((respResponse) => {
      connection.write(respResponse);
    });
  });

  connection.on("close", () => {
    deleteTransaction(connectionUUID);
  });
});
//
server.listen(PORT, "127.0.0.1");
