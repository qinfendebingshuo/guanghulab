export declare const apiName = "internal.lwp.setSessionIdCookie";
/**
 * 将lwp sessionId种到cookie 请求参数定义
 * @apiName internal.lwp.setSessionIdCookie
 */
export interface IInternalLwpSetSessionIdCookieParams {
    [key: string]: any;
}
/**
 * 将lwp sessionId种到cookie 返回结果定义
 * @apiName internal.lwp.setSessionIdCookie
 */
export interface IInternalLwpSetSessionIdCookieResult {
    [key: string]: any;
}
/**
 * 将lwp sessionId种到cookie
 * @apiName internal.lwp.setSessionIdCookie
 * @supportVersion  ios: 3.5.2 android: 3.5.2
 */
export declare function setSessionIdCookie$(params: IInternalLwpSetSessionIdCookieParams): Promise<IInternalLwpSetSessionIdCookieResult>;
export default setSessionIdCookie$;
