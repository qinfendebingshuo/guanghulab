export declare const apiName = "internal.cspace.cancelDecryptAndUpload";
/**
 * 取消（下载、解密、上传）的过程 请求参数定义
 * @apiName internal.cspace.cancelDecryptAndUpload
 */
export interface IInternalCspaceCancelDecryptAndUploadParams {
    [key: string]: any;
}
/**
 * 取消（下载、解密、上传）的过程 返回结果定义
 * @apiName internal.cspace.cancelDecryptAndUpload
 */
export interface IInternalCspaceCancelDecryptAndUploadResult {
    [key: string]: any;
}
/**
 * 取消（下载、解密、上传）的过程
 * @apiName internal.cspace.cancelDecryptAndUpload
 * @supportVersion  pc: 4.2.5 ios: 4.2.5 android: 4.2.5
 */
export declare function cancelDecryptAndUpload$(params: IInternalCspaceCancelDecryptAndUploadParams): Promise<IInternalCspaceCancelDecryptAndUploadResult>;
export default cancelDecryptAndUpload$;
