import type { ServerRole } from "./db_store";

export const SERVER_CONFIG = {
  port: 6379,
  role: "master" as ServerRole,
  masterPort: undefined as number | undefined,
};
