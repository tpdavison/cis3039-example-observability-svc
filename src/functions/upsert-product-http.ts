import { app } from '@azure/functions';
import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { upsertProduct } from '../app/upsert-product';
import type { UpsertProductCommand } from '../app/upsert-product';
import { createUpsertProductDeps } from '../config/composition-root';

type RequestValidationIssue = {
  readonly field: keyof UpsertProductCommand | 'body';
  readonly message: string;
};

type ParseResult =
  | { readonly success: true; readonly data: UpsertProductCommand }
  | {
      readonly success: false;
      readonly issues: readonly RequestValidationIssue[];
    };

function parseCommand(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      success: false,
      issues: [
        { field: 'body', message: 'Request body must be a JSON object' },
      ],
    };
  }
  const record = body as Record<string, unknown>;
  const { id, name, pricePence, description } = record;
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof description !== 'string' ||
    typeof pricePence !== 'number'
  ) {
    const issues: RequestValidationIssue[] = [];
    if (typeof id !== 'string') {
      issues.push({ field: 'id', message: 'Product id must be a string.' });
    }
    if (typeof name !== 'string') {
      issues.push({ field: 'name', message: 'Product name must be a string.' });
    }
    if (typeof pricePence !== 'number') {
      issues.push({
        field: 'pricePence',
        message: 'Product pricePence must be a number.',
      });
    }
    if (typeof description !== 'string') {
      issues.push({
        field: 'description',
        message: 'Product description must be a string.',
      });
    }
    return {
      success: false,
      issues,
    };
  }
  return { success: true, data: { id, name, pricePence, description } };
}

const upsertProductHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  let stage = 'request-parsing';
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Request body must be valid JSON',
        },
      };
    }

    stage = 'request-validation';
    const parsed = parseCommand(body);
    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Invalid product object supplied',
          error: parsed.issues.map((issue) => issue.message).join(' '),
        },
      };
    }

    stage = 'dependency-construction';
    const deps = createUpsertProductDeps();
    stage = 'use-case-execution';
    const result = await upsertProduct(deps, parsed.data);

    stage = 'response-mapping';
    if (!result.success) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Product validation failed',
          error: result.issues.map((issue) => issue.message).join(' '),
        },
      };
    }

    return {
      status: 200,
      jsonBody: {
        id: result.data.id,
        name: result.data.name,
        pricePence: result.data.pricePence,
        description: result.data.description,
        updatedAt: result.data.updatedAt.toISOString(),
      },
    };
  } catch (error: unknown) {
    context.error(
      JSON.stringify({
        operation: 'upsert-product',
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
      jsonBody: {
        success: false,
        message: 'Internal server error',
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
