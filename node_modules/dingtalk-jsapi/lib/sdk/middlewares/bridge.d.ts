import { Sdk } from '..';
import { IApiMiddlewareContext } from '../sdkLib';
/**
 * 通过 JSBridge 调用 native 接口，读取 context.{method, invokeName, callParams, JSBridge}
 */
export declare function bridge(this: Sdk, context: IApiMiddlewareContext): Promise<any>;
