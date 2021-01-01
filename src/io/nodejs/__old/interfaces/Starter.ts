export default interface Starter {
  init(): Promise<void>;
  start(): Promise<void>;
  destroy(): Promise<void>;
}
