import {
  AxiosError as IAxiosError,
  AxiosInstance as IAxiosInstance,
  AxiosRequestConfig as IAxiosRequestConfig,
  AxiosResponse as IAxiosResponse
} from 'axios';
import { FORMAT_HTTP_HEADERS, globalTracer, Span as ISpan, Tags, Tracer as ITracer } from 'opentracing';

export interface IOptions {
  spanName?: string;
  span?: ISpan;
}

export interface IAxiosOpentracingRequestConfig extends IAxiosRequestConfig {
  span?: ISpan;
}

export interface IAxiosOpentracingError extends IAxiosError {
  config: IAxiosOpentracingRequestConfig;
}

export interface IAxiosOpentracingResponse extends IAxiosResponse {
  config: IAxiosOpentracingRequestConfig;
}

/**
 * Factory for request interceptors. Produces interceptor which creates a tracing span for a request.
 * Spans are created on every request. Span contains information about request as tags.
 *
 * @param {ITracer} Tracer — tracer instance
 * @param {ISpan} rootSpan — span wich will be used as root
 *
 * @return {Function<IAxiosOpentracingRequestConfig>} axios request interceptor
 */
function createRequestInterceptor(Tracer: ITracer, rootSpan: ISpan) {
   return function axiosOpentracingRequestInterceptor(config: IAxiosRequestConfig) {
     const modifiedConfig = config as IAxiosOpentracingRequestConfig;

     try {
       const span = Tracer.startSpan(`${config.method}: ${config.baseURL}${config.url}`, {
         childOf: rootSpan
       });

       span.setTag(Tags.HTTP_METHOD, config.method);
       span.setTag(Tags.HTTP_URL, config.url);
       span.setTag(Tags.SPAN_KIND, Tags.SPAN_KIND_RPC_CLIENT);
       Tracer.inject(span, FORMAT_HTTP_HEADERS, config.headers);

       modifiedConfig.span = span;
     } catch (e) {}

     return modifiedConfig;
   };
 }

/**
 * Handler for request error interceptor. Marks span with error and finishes it.
 *
 * @param {IAxiosOpentracingError} error - Axios error
 * @param {IAxiosOpentracingRequestConfig} error.config - request config
 * @param {ISpan} error.config.span - span which was created in request interceptor
 *
 * @return {Promise<IAxiosOpentracingError>} Promise reject with axios error
 */
/**
 * Ignoring due to incorrect work with request error interceptors in axios
 * See: https://github.com/axios/axios/issues/1556
 */
/* istanbul ignore next */
function requestErrorInterceptor(error: IAxiosOpentracingError) {
  if (error.config) {
    const { span } = error.config;
    try {
      span.setTag(Tags.ERROR, true);
      span.setTag('reason', 'error in request');
      span.finish();
    } catch (e) {}
  }
  return Promise.reject(error);
}

/**
 * Handler for response success interceptor. Marks span with code and finishes it.
 *
 * @param {IAxiosOpentracingResponse} response - Axios response
 * @param {IAxiosOpentracingRequestConfig} response.config - request config
 * @param {ISpan} response.config.span - span which was created in request interceptor
 *
 * @return {IAxiosOpentracingResponse} response
 */
function responseSuccessInterceptor(response: IAxiosOpentracingResponse) {
  if (response.config && response.config.span) {
    const { span } = response.config;
    try {
      span.setTag(Tags.HTTP_STATUS_CODE, response.status);
      span.finish();
    } catch (e) {}
  }
  return response;
}

/**
 * Handler for response error interceptor. Marks span with error and code and finishes it.
 *
 * @param {IAxiosOpentracingError} error - Axios error
 * @param {IAxiosOpentracingRequestConfig} error.config - request config
 * @param {ISpan} error.config.span - span which was created in request interceptor
 *
 * @return {Promise<IAxiosOpentracingResponse>} Promise reject with axios response
 */
function responseErrorInterceptor(error: IAxiosOpentracingError) {
  if (error.config) {
    const { span } = error.config;
    try {
      span.setTag(Tags.ERROR, true);
      span.setTag(Tags.HTTP_STATUS_CODE, error.code);
      span.finish();
    } catch (e) {}
  }
  return Promise.reject(error);
}

/**
 * Factory for tracing initialization. Produces function which sets tracing interceptors on an axios instance.
 *
 * @param {ITracer} Tracer - Tracer implementation (uses global tracer by default).
 *
 * @return {Function} axios tracing enhancer.
 */
export default function createAxiosTracing(Tracer: ITracer = globalTracer()) {
  /**
   * Modifier for an axios instance. Uses passed span or creates new one with passed name
   * which will be used as a root span. Either span or spanName are required in instanceOptions.
   *
   * @param {IAxiosInstance} axiosInstance — axios instance which will be modified
   * @param {IOptions} instanceOptions — options
   * @param {ISpan} instanceOptions.span — root span, from which inherits child spans
   * @param {String} instanceOptions.spanName — name for root span
   *
   * @return {Span} root span that is used for child spans
   */
  return function applyTracingInterceptors(axiosInstance: IAxiosInstance, instanceOptions: IOptions = {}): ISpan {
    const { spanName, span } = instanceOptions;
    if (!axiosInstance) {
      throw new TypeError('axios-opentracing: axios or axios instance required!');
    }

    if (!instanceOptions || !spanName && !span) {
      throw new TypeError('axios-opentracing: either span or spanName should be passed in options!');
    }

    const rootSpan = span || Tracer.startSpan(spanName);

    axiosInstance.interceptors.request.use(
      createRequestInterceptor(Tracer, rootSpan),
      requestErrorInterceptor
    );

    axiosInstance.interceptors.response.use(
      responseSuccessInterceptor,
      responseErrorInterceptor
    );

    return rootSpan;
  };
}
