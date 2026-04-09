import { type RedisStreamEntry } from "./db";

export type CommandResult =
  | { type: "simple"; value: string }
  | { type: "bulk"; value: string }
  | { type: "bulk_null" }
  | { type: "integer"; value: number }
  | { type: "array"; value: string[] }
  | { type: "array_null" }
  | { type: "stream_range"; value: RedisStreamEntry[] }
  | { type: "stream_read"; value: [string, RedisStreamEntry[]] | void }
  | { type: "error"; value: string }
  | { type: "raw"; value: string };
