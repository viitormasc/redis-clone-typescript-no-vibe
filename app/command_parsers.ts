export function parseIntegerArgument(value: string): number {
  return Number.parseInt(value, 10);
}

export function parseFloatArgument(value: string): number {
  return Number.parseFloat(value);
}

export function parseStreamId(id: string): [number, number] {
  const [msTime, incremental] = id
    .split("-")
    .map((value) => parseIntegerArgument(value));
  return [msTime, incremental];
}

export function splitStreamId(id: string): [string, string | undefined] {
  const [msTime, incremental] = id.split("-");
  return [msTime, incremental];
}
