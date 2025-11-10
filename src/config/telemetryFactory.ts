import * as appInsights from 'applicationinsights';
import { Telemetry } from '../app/telemetry';
import { ConsoleTelemetry } from '../infra/console-telemetry';
import { AppInsightsTelemetry } from '../infra/appinsights-telemetry';

let cachedTelemetry: Telemetry | null = null;
let appInsightsInitialized = false;

/**
 * Initialize Application Insights if connection string is provided.
 * This should be called once at application startup.
 */
export function initializeAppInsights(): void {
  if (appInsightsInitialized) {
    return;
  }

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!connectionString || connectionString.trim() === '') {
    console.log(
      '[Telemetry] Application Insights not configured. Using console telemetry.'
    );
    appInsightsInitialized = true;
    return;
  }

  try {
    appInsights
      .setup(connectionString)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(false) // Set to true if you want live metrics
      .setDistributedTracingMode(
        appInsights.DistributedTracingModes.AI_AND_W3C
      );

    // Set cloud role for better filtering in App Insights
    appInsights.defaultClient.context.tags[
      appInsights.defaultClient.context.keys.cloudRole
    ] = process.env.WEBSITE_SITE_NAME || 'products-svc';

    appInsights.defaultClient.context.tags[
      appInsights.defaultClient.context.keys.cloudRoleInstance
    ] = process.env.WEBSITE_INSTANCE_ID || require('os').hostname();

    appInsights.start();

    console.log('[Telemetry] Application Insights initialized successfully');
    appInsightsInitialized = true;
  } catch (error) {
    console.error(
      '[Telemetry] Failed to initialize Application Insights:',
      error
    );
    appInsightsInitialized = true; // Mark as initialized to prevent retry
  }
}

/**
 * Get the telemetry instance.
 * Returns AppInsightsTelemetry if connection string is configured,
 * otherwise returns ConsoleTelemetry.
 */
export function getTelemetry(): Telemetry {
  if (!appInsightsInitialized) {
    initializeAppInsights();
  }

  if (cachedTelemetry) {
    return cachedTelemetry;
  }

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (
    connectionString &&
    connectionString.trim() !== '' &&
    appInsights.defaultClient
  ) {
    cachedTelemetry = new AppInsightsTelemetry(appInsights.defaultClient);
    console.log('[Telemetry] Using Application Insights telemetry');
  } else {
    cachedTelemetry = new ConsoleTelemetry();
    console.log('[Telemetry] Using console telemetry');
  }

  return cachedTelemetry;
}

/**
 * Flush telemetry data to Application Insights.
 * Call this before shutting down the application.
 */
export async function flushTelemetry(): Promise<void> {
  if (appInsights.defaultClient) {
    appInsights.defaultClient.flush();
    console.log('[Telemetry] Telemetry flushed');
    // Give it a moment to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
