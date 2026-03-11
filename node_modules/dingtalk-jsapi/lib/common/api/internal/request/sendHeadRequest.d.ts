export declare const apiName = "internal.request.sendHeadRequest";
/**
 * 发送http head请求 请求参数定义
 * @apiName internal.request.sendHeadRequest
 */
export interface IInternalRequestSendHeadRequestParams {
    url: string;
    headers: any;
}
/**
 * 发送http head请求 返回结果定义
 * @apiName internal.request.sendHeadRequest
 */
export interface IInternalRequestSendHeadRequestResult {
    statusCode: string;
    headers: any;
}
/**
 * 发送http head请求
 * @apiName internal.request.sendHeadRequest
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function sendHeadRequest$(params: IInternalRequestSendHeadRequestParams): Promise<IInternalRequestSendHeadRequestResult>;
export default sendHeadRequest$;
