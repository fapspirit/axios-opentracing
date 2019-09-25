# axios-opentracing
[![Build Status](https://travis-ci.com/fapspirit/axios-opentracing.svg?branch=master)](https://travis-ci.com/fapspirit/axios-opentracing)
[![Coverage Status](https://coveralls.io/repos/fapspirit/axios-opentracing/badge.svg?branch=master)](https://coveralls.io/r/fapspirit/axios-opentracing?branch=master)
[![NPM version](https://img.shields.io/npm/v/axios-opentracing.svg)](https://www.npmjs.com/package/axios-opentracing)

Axios interceptor which traces your requests 👀

## Motivation
Using opentracing in node.js is kinda hard because you need to keep context of current request.
This package helps you to abstract tracing logic for your http calls with axios interceptors.

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

And you also need any APM agent of your choice ([Jaeger](https://github.com/jaegertracing/jaeger-client-node), [Elastic APM](https://github.com/elastic/apm-agent-nodejs), [Lightstep](https://github.com/lightstep/lightstep-tracer-javascript), etc.) or your own implementation if it is [compatible with Opentracing API](https://github.com/opentracing/opentracing-javascript#opentracing-tracer-implementations).

## Usage
This package contains one function-intializer that take your tracer as an argument and produces function-wrapper which will wrap your axios instance with interceptors:
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

Either `span` or `spanName` are required. If you pass `span` then all the spans for your requests will be inherited from the passed one. If you pass `spanName` then the new span with passed name will be created and used as a root span. If you pass both then passed `span` will be used. The wrapper returns span that was used (passed or created).

## Example
You can use any tracer, in this examples I will use Jaeger.

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
const rootSpan = tracer.startSpan('api_http_call');

// Setup an axios instance
const API = axios.create({
  baseURL: 'https://example.com'
});

// Setup tracing interceptors
applyTracingInterceptors(API, { span: rootSpan });

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

The tricky part is that you need to create an axios instance on every request that your server handles because we need to keep context. This problem can be solved simply by creating middleware which will produce axios instances and pass it to your handlers through request context:

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
axios-opentracing can be used to trace requests that your application makes while using SSR. As in express example, an axios instance can be initialized and passed to an application context and used in an application as a regular axios instance wherever you want. Just setup a common interface for a client and a server so that your logic implementation does not depend on the environment.

## Contributing
PRs are welcome!
Feel free to ask questions in issues.
