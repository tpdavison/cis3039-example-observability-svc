import { Telemetry } from '../app/telemetry';

/**
 * Console-based telemetry implementation.
 * Used as the default telemetry when Application Insights is not configured.
 */
export class ConsoleTelemetry implements Telemetry {
  debug(message: string): void {
    console.debug(message);
  }

  error(message: string): void {
    console.error(message);
  }

  info(message: string): void {
    console.info(message);
  }

  trace(message: string): void {
    console.trace(message);
  }

  warn(message: string): void {
    console.warn(message);
  }

  event(
    name: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    console.info(`[EVENT] ${name}`, properties || {}, measurements || {});
  }

  metric(
    name: string,
    value: number,
    properties?: { [key: string]: string }
  ): void {
    console.info(`[METRIC] ${name}: ${value}`, properties || {});
  }

  dependency(
    dependencyTypeName: string,
    name: string,
    data: string,
    duration: number,
    success: boolean,
    properties?: { [key: string]: string }
  ): void {
    console.info(
      `[DEPENDENCY] ${dependencyTypeName} - ${name}: ${
        success ? 'SUCCESS' : 'FAILED'
      } (${duration}ms)`,
      { data, ...properties }
    );
  }
}
