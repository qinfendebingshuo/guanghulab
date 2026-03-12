export declare const apiName = "internal.log.upload";
/**
 * 上报日志到服务端 请求参数定义
 * @apiName internal.log.upload
 */
export interface IInternalLogUploadParams {
    [key: string]: any;
}
/**
 * 上报日志到服务端 返回结果定义
 * @apiName internal.log.upload
 */
export interface IInternalLogUploadResult {
    [key: string]: any;
}
/**
 * 上报日志到服务端
 * @apiName internal.log.upload
 * @supportVersion  ios: 2.6.0 android: 2.6.0
 */
export declare function upload$(params: IInternalLogUploadParams): Promise<IInternalLogUploadResult>;
export default upload$;
