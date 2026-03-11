export declare const apiName = "biz.oauth.authorize";
/**
 * authorize 请求参数定义
 * @apiName biz.oauth.authorize
 */
export interface IBizOauthAuthorizeParams {
    [key: string]: any;
}
/**
 * authorize 返回结果定义
 * @apiName biz.oauth.authorize
 */
export interface IBizOauthAuthorizeResult {
    [key: string]: any;
}
/**
 * authorize
 * @apiName biz.oauth.authorize
 * @supportVersion  pc: 2.5.0
 */
export declare function authorize$(params: IBizOauthAuthorizeParams): Promise<IBizOauthAuthorizeResult>;
export default authorize$;
