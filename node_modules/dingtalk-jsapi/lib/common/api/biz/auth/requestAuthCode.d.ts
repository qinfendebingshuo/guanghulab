export declare const apiName = "biz.auth.requestAuthCode";
/**
 * JS免登 请求参数定义
 * @apiName biz.auth.requestAuthCode
 */
export interface IBizAuthRequestAuthCodeParams {
    [key: string]: any;
}
/**
 * JS免登 返回结果定义
 * @apiName biz.auth.requestAuthCode
 */
export interface IBizAuthRequestAuthCodeResult {
    [key: string]: any;
}
/**
 * JS免登
 * @apiName biz.auth.requestAuthCode
 * @supportVersion  ios: 2.15 android: 2.15
 */
export declare function requestAuthCode$(params: IBizAuthRequestAuthCodeParams): Promise<IBizAuthRequestAuthCodeResult>;
export default requestAuthCode$;
