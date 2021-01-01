export default interface NetworkMessage {
  // 1 byte number, max 255. Each mediate host decrements this value.
  TTL: number;
  // 8 bytes hash which uses to send responses back
  messageId: string;
  // 2 or more character which represent resource on the host "to"
  // which listens to income requests
  uri: string;
  // hostId which is recipient of this message
  to: string;
  // complete route between "from" and bearer(last host which sent this message)
  // "from" is the first element and bearer is the last  one.
  completeRoute: string[];
  payload: Uint8Array;
}
