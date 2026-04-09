import {
  addKeyListValue,
  getBlockedPop,
  getKeyListRangeValues,
  getKeyValue,
  getListLength,
  getValueType as getValueTypeFromValues,
  pushListValues,
  removeArrayValues,
  setKeyValue,
} from "./value_db";
import {
  addStreamValues,
  getStreamRangeExclusive,
  getStreamRangeInclusive,
  getStreamType,
} from "./stream_db";

export type { RedisStreamDBArguments } from "./db_store";
export {
  addKeyListValue,
  addStreamValues,
  getBlockedPop,
  getKeyListRangeValues,
  getKeyValue,
  getListLength,
  getStreamRangeExclusive,
  getStreamRangeInclusive,
  pushListValues,
  removeArrayValues,
  setKeyValue,
};

export function getValueType(textArray: string[]): string {
  const valueType = getValueTypeFromValues(textArray);
  if (valueType !== "none") {
    return valueType;
  }

  return getStreamType(textArray[0]);
}
