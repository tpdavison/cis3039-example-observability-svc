import { app } from '@azure/functions';
import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { listProducts } from '../app/list-products';
import { createListProductsDeps } from '../config/composition-root';

const listProductsHandler = async (
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  let stage = 'dependency-construction';
  try {
    const deps = createListProductsDeps();
    stage = 'use-case-execution';
    const result = await listProducts(deps);
    stage = 'response-mapping';
    return {
      status: 200,
      jsonBody: result.data.map((product) => ({
        id: product.id,
        name: product.name,
        pricePence: product.pricePence,
        description: product.description,
        updatedAt: product.updatedAt.toISOString(),
      })),
    };
  } catch (error: unknown) {
    context.error(
      JSON.stringify({
        operation: 'list-products',
        outcome: 'failure',
        stage,
        exceptionType: error instanceof Error ? error.name : 'NonErrorThrown',
        // Keep stack frames, excluding messages that could contain input or secrets.
        stack:
          error instanceof Error
            ? error.stack
                ?.split('\n')
                .filter((line) => /^\s+at /.test(line))
                .join('\n')
            : undefined,
      }),
    );
    return {
      status: 500,
      jsonBody: { success: false, message: 'Internal server error' },
    };
  }
};

app.http('listProductsHttp', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'products',
  handler: listProductsHandler,
});
