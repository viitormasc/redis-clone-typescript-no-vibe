import * as net from "net";
import { restArrayToRestResponse } from "./resp";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const PING_COMMAND = "PING";
// Uncomment the code below to pass the first stage
const server: net.Server = net.createServer((connection: net.Socket) => {
  //   // Handle connection
  connection.on("data", (command) => {
    console.log("(command)", command);
    const respReponse = restArrayToRestResponse(command);
    connection.write(respReponse);
  });
});
//
server.listen(6379, "127.0.0.1");
