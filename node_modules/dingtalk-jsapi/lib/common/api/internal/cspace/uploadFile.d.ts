export declare const apiName = "internal.cspace.uploadFile";
/**
 * 将给出路径的本地文件上传保存到钉盘 请求参数定义
 * @apiName internal.cspace.uploadFile
 */
export interface IInternalCspaceUploadFileParams {
    /** 文件路径：使用其他JSAPI返回的APFilePath。 */
    path: string;
    /** 文件名 */
    name?: string;
    /** 钉盘空间ID */
    spaceId: string;
    /** 钉盘目录ID */
    folderId?: string;
    /** 操作ID */
    opeId: string;
}
/**
 * 将给出路径的本地文件上传保存到钉盘 返回结果定义
 * @apiName internal.cspace.uploadFile
 */
export interface IInternalCspaceUploadFileResult {
    data: {
        /** 文件所在钉盘空间的ID */
        spaceId: string;
        /** 钉盘文件ID */
        fileId: string;
        /** 文件的名称 */
        fileName: string;
        /** 文件大小，单位：byte（字节） */
        fileSize: number;
        /** 文件扩展名 */
        fileType: string;
    };
}
/**
 * 将给出路径的本地文件上传保存到钉盘
 * @apiName internal.cspace.uploadFile
 * @supportVersion ios: 4.6.37 android: 4.6.37
 */
export declare function uploadFile$(params: IInternalCspaceUploadFileParams): Promise<IInternalCspaceUploadFileResult>;
export default uploadFile$;
