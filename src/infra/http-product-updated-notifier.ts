import type {
  ProductUpdatedNotifier,
  ProductUpdatedDto,
} from '../app/product-updated-notifier';
import { getTelemetry } from '../config/telemetryFactory';

export type HttpProductUpdatedNotifierOptions = {
  baseUrl: string;
  fetch: typeof fetch;
};

export class HttpProductUpdatedNotifier implements ProductUpdatedNotifier {
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(options: HttpProductUpdatedNotifierOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchFn = options.fetch;
  }

  async notifyProductUpdated(product: ProductUpdatedDto): Promise<void> {
    const telemetry = getTelemetry();
    const startTime = Date.now();
    const url = `${this.baseUrl}/integration/events/product-updated`;

    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
      });

      const duration = Date.now() - startTime;
      const success = response.ok;

      telemetry.dependency(
        'HTTP',
        'ProductUpdatedNotification',
        url,
        duration,
        success,
        {
          productId: product.id,
          statusCode: response.status.toString(),
        }
      );

      if (!success) {
        telemetry.warn(
          `Product updated notification returned status ${response.status} for ${product.id}`
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      telemetry.dependency(
        'HTTP',
        'ProductUpdatedNotification',
        url,
        duration,
        false,
        { productId: product.id }
      );

      telemetry.error(
        `Failed to send product updated notification for ${product.id}: ${
          (error as Error).message
        }`
      );

      throw error;
    }
  }
}
