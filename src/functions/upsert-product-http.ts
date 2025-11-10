import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { upsertProduct } from '../app/upsert-product';
import { makeUpsertProductDeps } from '../config/appServices';
import { getTelemetry } from '../config/telemetryFactory';

const upsertProductHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const telemetry = getTelemetry();
  const invocationId = context.invocationId;

  telemetry.info(
    `Upsert product request received [${invocationId}] ${request.method} ${request.url}`
  );

  try {
    const body = (await request.json()) as any;

    // Validate required fields
    if (!body || typeof body !== 'object') {
      telemetry.warn(`Invalid request body [${invocationId}]`);
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Request body is required',
        },
      };
    }

    const { id, name, pricePence, description } = body;

    if (!id || !name || pricePence === undefined || !description) {
      telemetry.warn(`Missing required fields [${invocationId}]`);
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Missing required fields: id, name, pricePence, description',
        },
      };
    }

    const deps = makeUpsertProductDeps(telemetry);
    const result = await upsertProduct(deps, {
      id,
      name,
      pricePence,
      description,
    });

    if (!result.success) {
      telemetry.error(
        `Failed to upsert product [${invocationId}] ${id}: ${result.error}`
      );
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Failed to upsert product',
          error: result.error,
        },
      };
    }

    telemetry.event('ProductUpserted', {
      invocationId,
      productId: result.data?.id || '',
      productName: result.data?.name || '',
      pricePence: String(result.data?.pricePence ?? 0),
    });

    telemetry.info(
      `Product upserted successfully [${invocationId}] ${result.data?.id}`
    );

    return {
      status: 200,
      jsonBody: {
        ...result.data,
        updatedAt: result.data?.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    telemetry.error(
      `Unhandled error in upsert product handler [${invocationId}]: ${
        (error as Error).message
      }`
    );
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Internal server error',
        error: (error as Error).message,
      },
    };
  }
};

app.http('upsertProductHttp', {
  methods: ['PUT', 'POST'],
  authLevel: 'anonymous',
  route: 'products',
  handler: upsertProductHandler,
});
