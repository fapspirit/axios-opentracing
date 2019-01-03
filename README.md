# axios-opentracing
Axios interceptor which traces your requests 👀

## Motivation
Using opentracing in node.js is kinda hard because you need to keep context of current request.
This package can help you abstract tracing logic for your http calls with axios interceptors.

## Installation
To use this package, you need to have [axios](https://github.com/axios/axios) and [opentracing](https://github.com/opentracing/opentracing-javascript):
With yarn:
```sh
yarn add axios opentracing axios-opentracing
```

Or with npm:
```sh
npm install axios opentracing axios-opentracing
```

And you also need any APM agent of your choice ([Jaeger](https://github.com/jaegertracing/jaeger-client-node), [Elastic APM](https://github.com/elastic/apm-agent-nodejs), [Lightstep](https://github.com/lightstep/lightstep-tracer-javascript), etc.) or your own implementation if it [compatible with Opentracing API](https://github.com/opentracing/opentracing-javascript#opentracing-tracer-implementations).

## Usage
This package contains one function-intializer that take tracer as argument and produces function-wrapper which will wrap your axios instace with interceptors:
```js
const createAxiosTracing = require('axios-opentracing');

const applyTracingInterceptors = createAxiosTracing(tracer);

applyTracingInterceptors(axiosInstance, { span: rootSpan });
```

Alternatively, you can use global tracer simply by calling initializer without any arguments:
```js
const opentracing = require('opentracing');
const createAxiosTracing = require('axios-opentracing');

opentracing.initGlobalTracer(new AnyTracer());

const applyTracingInterceptors = createAxiosTracing();

applyTracingInterceptors(AxiosInstance, { span: rootSpan });
```

Produced function may be called on every request that your server handles. It takes your axios instance as 1st argument and options as 2nd argument, which looks like this:
```js
const axiosTracingOptions = {
  span: rootSpan,
  spanName: 'Your span name'
};
```

Either `span` or `spanName` are required. If you pass `span` then all the spans for your requests will be inhereted from passed one. If you pass `spanName` then new span with passed name will be created and threated as root span. If you path both then passed `span` will be used. The wrapper returns span that was used (passed or created).

## Example
You can use any tracer you want, in this examples I will use Jaeger.

### Simple

```js
const axios = require('axios');
const { initTracer } = require('jaeger-client');
const createAxiosTracing = require('axios-opentracing');

// Setup tracer
const tracer = initTracer(tracingConfig, tracingOptions);

// Create tracing applyer
const applyTracingInterceptors = createAxiosTracing(tracer);

// Create root span
const rootSpan = tracer.createSpan('api_http_call');

// Setup an axios instance
const API = axios.create({
  baseURL: 'https://example.com'
});

// Setup tracing interceptors
applyTracingInterceptors(API, { rootSpan });

// Make some requests
Promise.all([
  API.get('/'),
  API.get('/some/path')
]).then(() => {
  /*
    When root span will be finished, you will see something like this in your tracing dashboard:

      api_http_call
      |
      |__ GET https://example.com/
      |
      |__ GET https://example.com/some/path
  */
  rootSpan.finish();
});
```

### With express
You can use axios-opentracing with [express-opentracing](https://github.com/opentracing-contrib/javascript-express) middleware:

```js
const express = require('express');
const expressOpentracing = require('express-opentracing');
const { initTracer } = require('jaeger-client');
const createAxiosTracing = require('axios-opentracing');

// Setup tracer
const tracer = initTracer();

// Create tracing applyer
const applyTracingInterceptors = createAxiosTracing(tracer);

//
const app = express();

// Setup express tracer middleware
app.use(expressOpentracing({ tracer }));

app.get('/some/path', (req, res) => {
  // Setup an axios instance
  const API = axios.create({
    baseURL: 'https://example.com'
  });

  applyTracingInterceptors(API, { span: req.span });

  API.get('/some/api/call').then((response) => res.end(response.data));
});
```

The tricky part is that you need to create axios instance on every request that your server handles because we need to keep context. This problem can be solved simply by creating middleware which will produce axios instances and pass it to your handlers through request context:

```js
// using global tracer
const applyTracingInterceptors = createAxiosTracing(tracer);

app.use(expressOpentracing({ tracer }));

app.use((req, res, next) => {
  const API = axios.create({
    baseURL: 'https://example.com'
  });

  applyTracingInterceptors(API, { span: req.span });

  req.API = API;

  next();
});

app.get('/some/path', (req, res) => {
  req.API.get('/some/api/call').then((response) => res.end(response.data));
});
```

### Isomorphic applications with SSR (React, Vue, etc.)
If you want trace requests that makes your application while SSR, axios-opentracing can help you with that. Similary as in express example, axios inatance might be initialized and passed to application context and used in application as regular axios instance wherever you want. Just setup common interface for client and server so your logic implementation will not depend on the environment.

## Contributing
PRs are welcome!
Feel free to ask questions in issues.
