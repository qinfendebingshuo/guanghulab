export declare const apiName = "internal.request.httpOverLWP";
/**
 * http转lwp 请求参数定义
 * @apiName internal.request.httpOverLWP
 */
export interface IInternalRequestHttpOverLWPParams {
    [key: string]: any;
}
/**
 * http转lwp 返回结果定义
 * @apiName internal.request.httpOverLWP
 */
export interface IInternalRequestHttpOverLWPResult {
    [key: string]: any;
}
/**
 * http转lwp
 * @apiName internal.request.httpOverLWP
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function httpOverLWP$(params: IInternalRequestHttpOverLWPParams): Promise<IInternalRequestHttpOverLWPResult>;
export default httpOverLWP$;
