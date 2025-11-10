import * as appInsights from 'applicationinsights';
import { Telemetry } from '../app/telemetry';

/**
 * Application Insights telemetry implementation.
 * Sends telemetry data to Azure Application Insights.
 */
export class AppInsightsTelemetry implements Telemetry {
  private client: appInsights.TelemetryClient;

  constructor(client: appInsights.TelemetryClient) {
    this.client = client;
  }

  debug(message: string): void {
    this.client.trackTrace({
      message,
    });
    console.debug(message);
  }

  error(message: string): void {
    this.client.trackTrace({
      message,
    });
    console.error(message);
  }

  info(message: string): void {
    this.client.trackTrace({
      message,
    });
    console.info(message);
  }

  trace(message: string): void {
    this.client.trackTrace({
      message,
    });
    console.trace(message);
  }

  warn(message: string): void {
    this.client.trackTrace({
      message,
    });
    console.warn(message);
  }

  event(
    name: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    this.client.trackEvent({
      name,
      properties,
      measurements,
    });
    console.info(`[EVENT] ${name}`, properties || {}, measurements || {});
  }

  metric(
    name: string,
    value: number,
    properties?: { [key: string]: string }
  ): void {
    this.client.trackMetric({
      name,
      value,
      properties,
    });
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
    this.client.trackDependency({
      dependencyTypeName,
      name,
      data,
      duration,
      success,
      resultCode: success ? 200 : 500,
      properties,
    });
    console.info(
      `[DEPENDENCY] ${dependencyTypeName} - ${name}: ${
        success ? 'SUCCESS' : 'FAILED'
      } (${duration}ms)`,
      { data, ...properties }
    );
  }
}
