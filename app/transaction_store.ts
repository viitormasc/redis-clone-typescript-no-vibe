import type {
  ConnectionUUID,
  QueuedCommand,
  ResponseWithSuccess,
  TransactionState,
} from "./db_store";

const transactions: Partial<Record<ConnectionUUID, TransactionState>> = {};

function getOrCreateTransaction(
  connectionUUID: ConnectionUUID,
): TransactionState {
  const transaction = transactions[connectionUUID];
  if (transaction) return transaction;

  const newTransaction: TransactionState = {
    uuid: connectionUUID,
    open: false,
    queue: [],
    role: "master",
  };
  transactions[connectionUUID] = newTransaction;
  return newTransaction;
}

export function isTransactionOpen(connectionUUID: ConnectionUUID): boolean {
  return getOrCreateTransaction(connectionUUID).open;
}

export function openTransaction(connectionUUID: ConnectionUUID): string {
  const transaction = getOrCreateTransaction(connectionUUID);
  transaction.open = true;
  transaction.queue = [];
  return "OK";
}

export function queueCommand(
  connectionUUID: ConnectionUUID,
  queuedCommand: QueuedCommand,
): void {
  getOrCreateTransaction(connectionUUID).queue.push(queuedCommand);
}

export function discardTransaction(
  connectionUUID: ConnectionUUID,
): ResponseWithSuccess {
  const transaction = getOrCreateTransaction(connectionUUID);
  if (!transaction.open) {
    return {
      success: false,
      message: "ERR DISCARD without MULTI",
    };
  }

  transaction.open = false;
  transaction.queue = [];
  return {
    success: true,
    message: "OK",
  };
}

export function takeQueuedCommands(
  connectionUUID: ConnectionUUID,
): QueuedCommand[] | string {
  const transaction = getOrCreateTransaction(connectionUUID);
  if (!transaction.open) {
    return "ERR EXEC without MULTI";
  }

  const queuedCommands = transaction.queue;
  transaction.open = false;
  transaction.queue = [];
  return queuedCommands;
}

export function deleteTransaction(connectionUUID: ConnectionUUID): void {
  delete transactions[connectionUUID];
}

export function getServerInfo(connectionUUID: ConnectionUUID): string {
  const server = getOrCreateTransaction(connectionUUID);
  const role = server.role;
  return `# Replication\n role:${role}`;
}
