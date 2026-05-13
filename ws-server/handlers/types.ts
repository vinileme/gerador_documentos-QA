/**
 * Contrato de mensagens WebSocket (browser) e eventos internos (HTTP /internal/emit).
 * O servidor WS retransmite o JSON recebido para a sala `jobId`.
 */
export type WsClientToServer = { type: "subscribe"; jobId: string } | { type: "ping" };

export type WsServerToClient =
  | { type: "subscribed"; jobId: string }
  | { type: "pong" }
  | {
      type: "progress";
      jobId: string;
      stage: string;
      message?: string;
      percent?: number;
    }
  | { type: "done"; jobId: string; payload: unknown }
  | { type: "error"; jobId: string; code: string; message: string };
