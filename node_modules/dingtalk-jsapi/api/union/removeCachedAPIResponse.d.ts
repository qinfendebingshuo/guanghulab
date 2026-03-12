import { ICommonAPIParams } from '../../constant/types';
/**
 * 删除已缓存的JSAPI返回值 请求参数定义
 * @apiName removeCachedAPIResponse
 */
export interface IUnionRemoveCachedAPIResponseParams extends ICommonAPIParams {
    jsapiName: string;
    removeAll: boolean;
}
/**
 * 删除已缓存的JSAPI返回值 返回结果定义
 * @apiName removeCachedAPIResponse
 */
export interface IUnionRemoveCachedAPIResponseResult {
}
/**
 * 删除已缓存的JSAPI返回值
 * @apiName removeCachedAPIResponse
 */
export declare function removeCachedAPIResponse$(params: IUnionRemoveCachedAPIResponseParams): Promise<IUnionRemoveCachedAPIResponseResult>;
export default removeCachedAPIResponse$;
