import { Sdk } from '..';
import { IApiMiddlewareContext, IApiMiddlewareNextFn } from '../sdkLib';
/**
 * 初始化 JSBridge，设置 context.JSBridge
 */
export declare function initBridge(this: Sdk, context: IApiMiddlewareContext, next: IApiMiddlewareNextFn): Promise<any>;
