import { Sdk } from '..';
import { IApiMiddlewareContext, IApiMiddlewareNextFn } from '../sdkLib';
/**
 * 在初次失败后根据配置 context.apiConfig 等选择是否重试
 */
export declare function retry(this: Sdk, context: IApiMiddlewareContext, next: IApiMiddlewareNextFn): Promise<any>;
