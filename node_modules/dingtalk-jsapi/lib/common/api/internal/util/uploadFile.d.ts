export declare const apiName = "internal.util.uploadFile";
/**
 * 内部专用的上传文件接口，上传到OSS，支持AuthType。 请求参数定义
 * @apiName internal.util.uploadFile
 */
export interface IInternalUtilUploadFileParams {
    /** 本地文件的虚拟地址 */
    path: string;
    /** 业务标识 */
    bizType: string;
    /**
     *  1，STRICT_AUTH, 严格鉴权,下载文件时需要回调业务方进行鉴权 。
     *  4，TEMP_AUTH,  临时文件，过期后删除文件，无法访问。
     *  6，CDN_ONLY，公开文件，上传后只可以通过https下载。
     */
    authType?: number;
    /** 仅当TEMP_AUTH时需要填写，指定过期时间 */
    expiredTime?: number;
    /** 任意唯一字符串，仅当需要进度返回时填写，用于防止同时调用多次上传时channel回调错乱 */
    sessionId?: string;
}
/**
 * 内部专用的上传文件接口，上传到OSS，支持AuthType。 返回结果定义
 * @apiName internal.util.uploadFile
 */
export interface IInternalUtilUploadFileResult {
    /** 文件mediaId地址 */
    mediaId: string;
}
/**
 * 内部专用的上传文件接口，上传到OSS，支持AuthType。
 * @apiName internal.util.uploadFile
 * @supportVersion ios: 4.6.37 android: 4.6.37
 */
export declare function uploadFile$(params: IInternalUtilUploadFileParams): Promise<IInternalUtilUploadFileResult>;
export default uploadFile$;
