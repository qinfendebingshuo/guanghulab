export declare const apiName = "internal.auth.postLoginTempCode";
/**
 * 向客户端POST登录临时授权码(灰度) 请求参数定义
 * @apiName internal.auth.postLoginTempCode
 */
export interface IInternalAuthPostLoginTempCodeParams {
    [key: string]: any;
}
/**
 * 向客户端POST登录临时授权码(灰度) 返回结果定义
 * @apiName internal.auth.postLoginTempCode
 */
export interface IInternalAuthPostLoginTempCodeResult {
    [key: string]: any;
}
/**
 * 向客户端POST登录临时授权码(灰度)
 * @apiName internal.auth.postLoginTempCode
 * @supportVersion  ios: 3.3.1 android: 3.3.1
 */
export declare function postLoginTempCode$(params: IInternalAuthPostLoginTempCodeParams): Promise<IInternalAuthPostLoginTempCodeResult>;
export default postLoginTempCode$;
