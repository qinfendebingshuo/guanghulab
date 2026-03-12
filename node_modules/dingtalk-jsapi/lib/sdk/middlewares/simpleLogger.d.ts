import { Sdk } from '..';
import { IApiMiddlewareContext, IApiMiddlewareNextFn } from '../sdkLib';
/**
 * 简易的 logger
 * @deprecated 不再内置
 */
export declare function simpleLogger(this: Sdk, context: IApiMiddlewareContext, next: IApiMiddlewareNextFn): Promise<any>;
