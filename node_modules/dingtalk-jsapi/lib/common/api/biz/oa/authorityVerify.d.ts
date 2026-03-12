export declare const apiName = "biz.oa.authorityVerify";
/**
 * 校验页面是否有权限设置工作首页链接 请求参数定义
 * @apiName biz.oa.authorityVerify
 */
export interface IBizOaAuthorityVerifyParams {
    [key: string]: any;
}
/**
 * 校验页面是否有权限设置工作首页链接 返回结果定义
 * @apiName biz.oa.authorityVerify
 */
export interface IBizOaAuthorityVerifyResult {
    [key: string]: any;
}
/**
 * 校验页面是否有权限设置工作首页链接
 * @apiName biz.oa.authorityVerify
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function authorityVerify$(params: IBizOaAuthorityVerifyParams): Promise<IBizOaAuthorityVerifyResult>;
export default authorityVerify$;
