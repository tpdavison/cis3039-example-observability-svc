export interface Telemetry {
  debug(message: string): void;
  error(message: string): void;
  info(message: string): void;
  trace(message: string): void;
  warn(message: string): void;
  
  // Azure Functions specific methods
  event(name: string, properties?: { [key: string]: string }, measurements?: { [key: string]: number }): void;
  metric(name: string, value: number, properties?: { [key: string]: string }): void;
  dependency(
    dependencyTypeName: string,
    name: string,
    data: string,
    duration: number,
    success: boolean,
    properties?: { [key: string]: string }
  ): void;
}
