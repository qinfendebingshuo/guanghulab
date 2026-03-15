export declare const apiName = "internal.diagnostic.getLocalErrorMsg";
/**
 * 获得最近三天极速打卡错误码信息 请求参数定义
 * @apiName internal.diagnostic.getLocalErrorMsg
 */
export interface IInternalDiagnosticGetLocalErrorMsgParams {
}
/**
 * 获得最近三天极速打卡错误码信息 返回结果定义
 * @apiName internal.diagnostic.getLocalErrorMsg
 */
export interface IInternalDiagnosticGetLocalErrorMsgResult {
    data: any;
}
/**
 * 获得最近三天极速打卡错误码信息
 * @apiName internal.diagnostic.getLocalErrorMsg
 * @supportVersion android: 4.7.19
 * @author Android: 序望
 */
export declare function getLocalErrorMsg$(params: IInternalDiagnosticGetLocalErrorMsgParams): Promise<IInternalDiagnosticGetLocalErrorMsgResult>;
export default getLocalErrorMsg$;
