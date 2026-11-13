# Products observability service

A small Azure Functions API for learning about request telemetry and structured
application logs. It uses TypeScript, Node.js 22, Azure Functions 4 and a seeded
in-memory Product repository.

Both endpoints allow anonymous access. Use this service only for the short-lived
lab with synthetic data. Anonymous write access is unsuitable for production.

## Development environment

Start Docker, then open the repository in VS Code with the Dev Containers
extension. Choose **Dev Containers: Reopen in Container** to use the supplied
course environment.

If you need your own private copy:

1. Clone `https://github.com/tpdavison/cis3039-example-observability-svc.git`.
2. Create an empty private GitHub repository with a name of your choice, without
   initial files.
3. From the cloned repository, replace `YOUR_GITHUB_USERNAME` and
   `YOUR_PRIVATE_REPOSITORY_NAME` below with your details and run:

```bash
git remote set-url origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_PRIVATE_REPOSITORY_NAME.git
git remote -v
git branch --show-current
```

Confirm that the remote points to your private repository and the branch is
`main`, then push the existing history:

```bash
git push -u origin main
```

If you already have a private copy, continue there. Keep its Git history.

## Run locally

Run the Bash commands below from the repository root inside the Dev Container.

```bash
npm ci
```

Create local settings from the template. Skip the copy if the file already
exists:

```bash
cp local.settings.template.json local.settings.json
```

Keep `FUNCTIONS_WORKER_RUNTIME` set to `node`. `local.settings.json` is excluded
from Git; keep connection strings and deployment credentials out of tracked files.

```bash
npm run typecheck
npm run build
npm start
```

`npm start` cleans and rebuilds `dist/` before starting the Functions host.
Leave it running, then open a second container terminal for the requests below.
The default local address is `http://localhost:7071`.

For another port, use `npm start -- --port 7079` and change the port in the
request URLs accordingly.

## Make requests

### List Products

```bash
curl -i http://localhost:7071/api/products
```

Expect HTTP 200 and an array containing the seeded Products `p-001` and `p-002`,
including their prices. Each Product has `id`, `name`, `pricePence`, `description`
and an ISO-formatted `updatedAt` timestamp.

### Create or update a Product

```bash
curl -i http://localhost:7071/api/products \
  -H 'Content-Type: application/json' \
  --data-binary @samples/product-post.json
```

Sending a body with curl selects POST. Expect HTTP 200 and the saved Product.
The supplied `id` identifies the Product to create or replace; the application
sets `updatedAt`. PUT is also accepted on the same route.

`id`, `name` and `description` must be non-empty strings. `pricePence` must be a
non-negative safe integer representing the price in pence.

### Submit invalid Product data

```bash
curl -i http://localhost:7071/api/products \
  -H 'Content-Type: application/json' \
  --data-binary @samples/product-post-invalid.json
```

This sample has `pricePence: -1`. Expect HTTP 400:

```json
{
  "success": false,
  "message": "Product validation failed",
  "error": "Product pricePence must be a non-negative safe integer."
}
```

### Submit malformed JSON

```bash
curl -i http://localhost:7071/api/products \
  -H 'Content-Type: application/json' \
  --data-binary '{'
```

Expect HTTP 400 with `message: "Request body must be valid JSON"`.

## Responses and data lifetime

| Request outcome | HTTP status | Response body |
| --- | --- | --- |
| Successful GET | 200 | Array of Products |
| Successful POST or PUT | 200 | Saved Product |
| Malformed JSON | 400 | `success: false` and a `message` |
| Invalid request body or field types | 400 | `success: false`, `message: "Invalid product object supplied"` and issue details in `error` |
| Invalid Product values | 400 | `success: false`, `message: "Product validation failed"` and issue details in `error` |
| Unexpected error | 500 | `success: false` and `message: "Internal server error"` |

The handler creates HTTP messages at the presentation boundary. Validation
details identify the problem without echoing submitted values. Unexpected
exception details are kept out of the client response.

The composition root caches one fake repository per worker/process. Product data
exists only in that worker's memory: restarts reset it, and scaled-out workers
have separate copies. A later Azure GET is not proof of globally persisted state.

## Application logs

The Functions host supplies HTTP request telemetry. The handlers add structured
JSON application logs using the current invocation's `InvocationContext` so the
logs can be associated with that request.

After a successful GET has been mapped to a response, the handler emits one
information-level message. For the initial seeded list, its JSON is:

```json
{"operation":"list-products","outcome":"success","recordCount":2}
```

Both handlers emit an error-level diagnostic before returning an unexpected
500. These records contain `operation`, `outcome: "failure"`, `stage` and
`exceptionType`, with stack frames when available. The stage identifies where
the failure occurred, such as dependency construction, use-case execution or
response mapping. Exception messages and arbitrary thrown values are omitted.

### Student extension: validation warnings

The supplied POST handler already validates requests and returns HTTP 400 for
invalid input. It does not emit a validation warning.

In the lab, add a structured warning at the HTTP boundary using the invocation's
context. Use stable values such as `operation: "upsert-product"`,
`outcome: "rejected"`, a validation reason, invalid field names and
`httpStatus: 400`. Request validation supplies `issues` with `field` and
`message`; a non-object request uses the field name `body`. Domain validation
also supplies field-level issues. Log field names without submitted values or
the full request body. Use the invalid sample above to exercise the rejection.

## Use with Azure monitoring

Follow the worksheet to provision the Function App and its **backend Application
Insights** resource linked to the environment's Log Analytics workspace. The
Function App uses Node.js 22 and Functions 4. Its application setting
`APPLICATIONINSIGHTS_CONNECTION_STRING` selects the backend telemetry resource;
configure it in Azure, outside tracked source.

Build and publish to your provisioned Function App, replacing the placeholder:

```bash
npm run build
func azure functionapp publish YOUR_FUNCTION_APP_NAME
```

Copy the Function App's actual hostname from Azure. Use
`https://YOUR_ACTUAL_FUNCTION_HOSTNAME/api/products` in place of the local URL
when sending the same requests to Azure.

The companion Vue app runs locally and sends browser telemetry to a separate
**frontend Application Insights** resource linked to the same workspace. Allow
its precise browser origin, normally `http://localhost:5173`, in the Function
App's CORS configuration, including the tracing headers used by the browser.
Trace context propagated with the HTTP request connects frontend dependencies
with backend requests; sharing a workspace alone does not establish correlation.

In the Log Analytics workspace's **Logs** view, `AppRequests` contains request
telemetry and `AppTraces` contains application log messages. The handler writes
JSON text; use `parse_json(Message)` to extract its fields. This example query
selects the service's structured diagnostics:

```kusto
AppTraces
| where TimeGenerated > ago(30m)
| extend diagnostic = parse_json(Message)
| where tostring(diagnostic.operation) in ("list-products", "upsert-product")
| project TimeGenerated, _ResourceId, OperationId, ParentId, SeverityLevel,
    Operation = tostring(diagnostic.operation),
    Outcome = tostring(diagnostic.outcome),
    RecordCount = toint(diagnostic.recordCount),
    Stage = tostring(diagnostic.stage)
| order by TimeGenerated desc
```

Use `_ResourceId` to identify the telemetry resource and `OperationId` to explore
related records. Telemetry can take time to arrive. Log-level filtering and
sampling affect visibility: `host.json` enables sampling while excluding request
records from that sampling rule.

See Microsoft's guides to [local Functions development](https://learn.microsoft.com/en-us/azure/azure-functions/functions-develop-local),
[Functions monitoring](https://learn.microsoft.com/en-us/azure/azure-functions/configure-monitoring)
and the [AppTraces table](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/tables/apptraces).

## Source layout

| Directory | Responsibility |
| --- | --- |
| `src/functions` | HTTP parsing, response mapping and invocation-scoped logging |
| `src/app` | Product use cases |
| `src/domain` | Product validation and the repository interface |
| `src/infra` | Fake in-memory repository |
| `src/config` | Dependency assembly and repository caching |
