import { ICommonAPIParams } from '../../../constant/types';
/**
 * 请求健康读取权限 请求参数定义
 * @apiName biz.sports.requestHealthAuthorization
 */
export interface IBizSportsRequestHealthAuthorizationParams extends ICommonAPIParams {
    types: string;
}
/**
 * 请求健康读取权限 返回结果定义
 * @apiName biz.sports.requestHealthAuthorization
 */
export interface IBizSportsRequestHealthAuthorizationResult {
    success: boolean;
}
/**
 * 请求健康读取权限
 * @apiName biz.sports.requestHealthAuthorization
 */
export declare function requestHealthAuthorization$(params: IBizSportsRequestHealthAuthorizationParams): Promise<IBizSportsRequestHealthAuthorizationResult>;
export default requestHealthAuthorization$;
