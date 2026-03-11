import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取已缓存的JSAPI返回值 请求参数定义
 * @apiName getCachedAPIResponse
 */
export interface IUnionGetCachedAPIResponseParams extends ICommonAPIParams {
}
/**
 * 获取已缓存的JSAPI返回值 返回结果定义
 * @apiName getCachedAPIResponse
 */
export interface IUnionGetCachedAPIResponseResult {
}
/**
 * 获取已缓存的JSAPI返回值
 * @apiName getCachedAPIResponse
 */
export declare function getCachedAPIResponse$(params: IUnionGetCachedAPIResponseParams): Promise<IUnionGetCachedAPIResponseResult>;
export default getCachedAPIResponse$;
