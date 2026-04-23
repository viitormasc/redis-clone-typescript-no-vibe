import type { ServerRole } from "./db_store";
export type ReplicationId = string;
export interface ServerInfo {
  port: number;
  role: ServerRole;
  masterPort: number | undefined;
  masterRepliId: ReplicationId;
  masterRepliOffSet: number;
}
export const SERVER_CONFIG: ServerInfo = {
  port: 6379,
  role: "master" as ServerRole,
  masterPort: undefined as number | undefined,
  masterRepliId: "8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb",
  masterRepliOffSet: 0,
};

export class ServerConfig implements ServerInfo {
  constructor(
    public readonly port: number,
    public readonly role: ServerRole,
    public readonly masterPort: number | undefined,
    public readonly masterRepliId: string,
    public readonly masterRepliOffSet: number,
  ) {}
}
