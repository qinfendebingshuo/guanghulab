export declare const apiName = "internal.request.getSecurityToken";
/**
 * 获取securityToken 请求参数定义
 * @apiName internal.request.getSecurityToken
 */
export interface IInternalRequestGetSecurityTokenParams {
    [key: string]: any;
}
/**
 * 获取securityToken 返回结果定义
 * @apiName internal.request.getSecurityToken
 */
export interface IInternalRequestGetSecurityTokenResult {
    [key: string]: any;
}
/**
 * 获取securityToken
 * @apiName internal.request.getSecurityToken
 * @supportVersion  ios: 2.7.0 android: 2.7.0
 */
export declare function getSecurityToken$(params: IInternalRequestGetSecurityTokenParams): Promise<IInternalRequestGetSecurityTokenResult>;
export default getSecurityToken$;
