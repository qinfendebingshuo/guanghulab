export declare const apiName = "internal.cspace.decryptAndUpload";
/**
 * 客户端下载钉盘文件，本地解密，并上传到个人临时空间 请求参数定义
 * @apiName internal.cspace.decryptAndUpload
 */
export interface IInternalCspaceDecryptAndUploadParams {
    [key: string]: any;
}
/**
 * 客户端下载钉盘文件，本地解密，并上传到个人临时空间 返回结果定义
 * @apiName internal.cspace.decryptAndUpload
 */
export interface IInternalCspaceDecryptAndUploadResult {
    [key: string]: any;
}
/**
 * 客户端下载钉盘文件，本地解密，并上传到个人临时空间
 * @apiName internal.cspace.decryptAndUpload
 * @supportVersion  pc: 4.2.5 ios: 4.2.5 android: 4.2.5
 */
export declare function decryptAndUpload$(params: IInternalCspaceDecryptAndUploadParams): Promise<IInternalCspaceDecryptAndUploadResult>;
export default decryptAndUpload$;
