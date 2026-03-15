export declare const apiName = "internal.cspace.cancelFileUpload";
/**
 * 取消上传文件到钉盘临时空间 请求参数定义
 * @apiName internal.cspace.cancelFileUpload
 */
export interface IInternalCspaceCancelFileUploadParams {
    opeId: string;
}
/**
 * 取消上传文件到钉盘临时空间 返回结果定义
 * @apiName internal.cspace.cancelFileUpload
 */
export interface IInternalCspaceCancelFileUploadResult {
    opeId: string;
}
/**
 * 取消上传文件到钉盘临时空间
 * @apiName internal.cspace.cancelFileUpload
 * @supportVersion ios: 4.3.5 android: 4.3.5
 */
export declare function cancelFileUpload$(params: IInternalCspaceCancelFileUploadParams): Promise<IInternalCspaceCancelFileUploadResult>;
export default cancelFileUpload$;
