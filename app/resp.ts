const DIVISOR = "\r\n";

export function restArrayToRestResponse(buffer: NonSharedBuffer): string {
  const respArrayText = buffer.toString("utf8");
  console.log("respArrayText", respArrayText);
  const propperRestArray = respArrayText.substring(1).split(DIVISOR);
  const numberOfElements = propperRestArray.shift();
  const messageArray = propperRestArray.filter(
    (value, index) => index % 2 !== 0,
  );
  const command = messageArray[0].toLowerCase();
  const textArray = messageArray.slice(1);
  let response: string[] = [];
  let respResponse: string = "";
  switch (command) {
    case "echo":
      response = runEchoCommand(textArray);
      respResponse = arrayToRestBulkString(response);
      break;
    case "ping":
      respResponse = runPingCommand();
      break;
  }

  return respResponse;
}

const respArrayTest = "*3\r\n$4\r\nEcHo\r\n$5\r\nhello\r\n$5\r\nworld\r\n";

function runEchoCommand(textArray: string[]) {
  return textArray;
}

function arrayToRestBulkString(textArray: string[]) {
  if (textArray.length == 0) return "$0\r\n\r\n";
  const length = textArray[0].length;
  textArray.unshift(`$${length}`);
  const response = textArray.join(DIVISOR).concat(DIVISOR);
  return response;
}

function runPingCommand() {
  return "+PONG\r\n";
}
