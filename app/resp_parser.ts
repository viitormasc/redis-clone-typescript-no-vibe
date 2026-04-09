const DIVISOR = "\r\n";

export function parseRespCommand(
  buffer: NonSharedBuffer | string,
): { respArrayText: string; messageArray: string[] } {
  const respArrayText = buffer.toString("utf8");
  const propperRestArray = respArrayText.substring(1).split(DIVISOR);
  propperRestArray.shift();

  const messageArray = propperRestArray.filter(
    (value, index) => index % 2 !== 0,
  );

  return { respArrayText, messageArray };
}
