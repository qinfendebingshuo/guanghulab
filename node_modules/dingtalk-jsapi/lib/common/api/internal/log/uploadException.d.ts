export declare const apiName = "internal.log.uploadException";
/**
 * 上报异常日志到服务端 请求参数定义
 * @apiName internal.log.uploadException
 */
export interface IInternalLogUploadExceptionParams {
    [key: string]: any;
}
/**
 * 上报异常日志到服务端 返回结果定义
 * @apiName internal.log.uploadException
 */
export interface IInternalLogUploadExceptionResult {
    [key: string]: any;
}
/**
 * 上报异常日志到服务端
 * @apiName internal.log.uploadException
 * @supportVersion  ios: 3.4.8 android: 3.4.8
 */
export declare function uploadException$(params: IInternalLogUploadExceptionParams): Promise<IInternalLogUploadExceptionResult>;
export default uploadException$;
