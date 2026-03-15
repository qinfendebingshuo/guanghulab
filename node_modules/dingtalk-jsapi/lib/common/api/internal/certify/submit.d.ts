export declare const apiName = "internal.certify.submit";
/**
 * 上班助手 请求参数定义
 * @apiName internal.certify.submit
 */
export interface IInternalCertifySubmitParams {
    [key: string]: any;
}
/**
 * 上班助手 返回结果定义
 * @apiName internal.certify.submit
 */
export interface IInternalCertifySubmitResult {
    [key: string]: any;
}
/**
 * 上班助手
 * @apiName internal.certify.submit
 * @supportVersion  ios: 2.12.0 android: 2.12.0
 */
export declare function submit$(params: IInternalCertifySubmitParams): Promise<IInternalCertifySubmitResult>;
export default submit$;
