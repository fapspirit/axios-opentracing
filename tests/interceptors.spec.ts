import axios, { AxiosInstance as IAxiosInstance } from 'axios';
import { expect } from 'chai';
import moxios from 'moxios';
import { globalTracer, Span as ISpan } from 'opentracing';
import createAxiosTracing, { IAxiosOpentracingRequestConfig, IOptions } from '../src/index';

describe('interceptors', () => {
  let applyTracingInterceptors: (axiosInstance: IAxiosInstance, options: IOptions) => ISpan;
  let axiosInstance: IAxiosInstance;

  beforeEach(() => {
    applyTracingInterceptors = createAxiosTracing();
    axiosInstance = axios.create({
      baseURL: '/'
    });

    moxios.install(axiosInstance);

    moxios.stubRequest('/', {
      responseText: 'test',
      status: 200
    });
  });

  afterEach(() => {
    moxios.uninstall(axiosInstance);
  });

  it('request interceptor', async () => {
    const span = applyTracingInterceptors(axiosInstance, { spanName: 'test' });

    const response = await axiosInstance.get('/');

    const config: IAxiosOpentracingRequestConfig = response.config;

    expect(config.span).to.be.an('object');
  });

  it.skip('request error interceptor', async () => {
    const span = applyTracingInterceptors(axiosInstance, { spanName: 'test' });

    axiosInstance.interceptors.request.use((conf) => {
      return Promise.reject(conf);
    }, (...args) => {});

    let config: IAxiosOpentracingRequestConfig;

    try {
      const response = await axiosInstance.get('/');
    } catch (error) {
      config = error;
    }

    expect(config.span).to.be(undefined);
  });

  it('response success interceptor', async () => {
    const span = applyTracingInterceptors(axiosInstance, { spanName: 'test' });

    const response = await axiosInstance.get('/');

    const config: IAxiosOpentracingRequestConfig = response.config;

    expect(config.span).to.be.an('object');
  });

  it('response error interceptor', async () => {
    moxios.stubRequest('/error', {
      responseText: 'test',
      status: 500
    });

    const span = applyTracingInterceptors(axiosInstance, { spanName: 'test' });
    let config: IAxiosOpentracingRequestConfig;

    try {
      const response = await axiosInstance.get('/error');
    } catch (error) {
      config = error.config;
    }

    expect(config.span).to.be.an('object');
  });
});
