import axios, { AxiosInstance as IAxiosInstance } from 'axios';
import { expect } from 'chai';
import { globalTracer, Span as ISpan } from 'opentracing';
import createAxiosTracing, { IOptions } from '../src/index';

describe('axios-opentracing', () => {
  describe('createAxiosTracing', () => {

    it('should be a function', () => {
      expect(createAxiosTracing).to.be.a('function');
    });

    it('should return function', () => {
      const applyTracingInterceptors = createAxiosTracing();

      expect(applyTracingInterceptors).to.be.a('function');
    });
  });

  describe('applyTracingInterceptors', () => {
    let applyTracingInterceptors: (axiosInstance: IAxiosInstance, options: IOptions) => ISpan;
    let axiosInstance: IAxiosInstance;

    beforeEach(() => {
      applyTracingInterceptors = createAxiosTracing();
      axiosInstance = axios.create({
          baseURL: 'https://example.com'
        });
    });

    it('should throw an error when no axios instance passed', () => {
      expect(() => {
        // @ts-ignore
        applyTracingInterceptors();
      }).to.throw(TypeError);
    });

    it('should throw an error when no options passed', () => {
      expect(() => {
        // @ts-ignore
        applyTracingInterceptors(axiosInstance);
      }).to.throw(TypeError);
    });

    it('should return new span when passed spanName', () => {
      const spanName = 'test';
      const span = applyTracingInterceptors(axiosInstance, { spanName });

      expect(span).to.be.an('object');
    });

    it('should return same span when he passed', () => {
      const tracer = globalTracer();
      const span = tracer.startSpan('test');
      const returnedSpan = applyTracingInterceptors(axiosInstance, { span });

      expect(span).to.be.equal(returnedSpan);
    });
  });
});
