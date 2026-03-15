import { Sdk } from '..';
import { IApiMiddlewareContext, IApiMiddlewareNextFn } from '../sdkLib';
/**
 * 调用 onBeforeInvokeAPI 及 onAfterInvokeAPI
 */
export declare function hookBeforeAndAfter(this: Sdk, context: IApiMiddlewareContext, next: IApiMiddlewareNextFn): Promise<any>;
