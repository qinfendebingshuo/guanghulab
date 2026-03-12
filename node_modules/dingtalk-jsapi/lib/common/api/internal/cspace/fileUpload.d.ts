export declare const apiName = "internal.cspace.fileUpload";
/**
 * 上传文件到钉盘临时空间 请求参数定义
 * @apiName internal.cspace.fileUpload
 */
export interface IInternalCspaceFileUploadParams {
    /** 企业id */
    cropId: string;
    opeId: string;
    /** 文件路径 */
    filePath: string;
    /** 文件名称 */
    fileName: string;
}
/**
 * 上传文件到钉盘临时空间 返回结果定义
 * @apiName internal.cspace.fileUpload
 */
export interface IInternalCspaceFileUploadResult {
    opeId: string;
    opeStatus: number;
    spaceId: string;
    fileId: string;
}
/**
 * 上传文件到钉盘临时空间
 * @apiName internal.cspace.fileUpload
 * @supportVersion ios: 4.3.5 android: 4.3.5
 */
export declare function fileUpload$(params: IInternalCspaceFileUploadParams): Promise<IInternalCspaceFileUploadResult>;
export default fileUpload$;
