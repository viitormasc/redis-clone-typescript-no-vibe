const DIVISOR = "\r\n";

export function parseRespCommand(buffer: NonSharedBuffer | string): {
  respArrayText: string;
  messageArray: string[];
} {
  const respArrayText = buffer.toString("utf8");
  console.log("respArrayText", respArrayText);
  const propperRestArray = respArrayText.substring(1).split(DIVISOR);
  console.log("propperRestArray", propperRestArray);
  propperRestArray.shift();

  const messageArray = propperRestArray.filter(
    (value, index) => index % 2 !== 0,
  );
  console.log("messageArray", messageArray);

  return { respArrayText, messageArray };
}
