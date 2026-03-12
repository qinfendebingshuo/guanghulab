import { Sdk } from '..';
import { IApiMiddlewareContext, IApiMiddlewareNextFn } from '../sdkLib';
/**
 * 根据 context.apiConfig 进行出入参处理，设置 context.{callParams, invokeName}
 */
export declare function dealParamsAndResult(this: Sdk, context: IApiMiddlewareContext, next: IApiMiddlewareNextFn): Promise<any>;
