export declare const apiName = "biz.alipay.auth";
/**
 * 支付宝移动支付Sdk，授权JS-API封装 请求参数定义
 * @apiName biz.alipay.auth
 */
export interface IBizAlipayAuthParams {
    [key: string]: any;
}
/**
 * 支付宝移动支付Sdk，授权JS-API封装 返回结果定义
 * @apiName biz.alipay.auth
 */
export interface IBizAlipayAuthResult {
    [key: string]: any;
}
/**
 * 支付宝移动支付Sdk，授权JS-API封装
 * @apiName biz.alipay.auth
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function auth$(params: IBizAlipayAuthParams): Promise<IBizAlipayAuthResult>;
export default auth$;
