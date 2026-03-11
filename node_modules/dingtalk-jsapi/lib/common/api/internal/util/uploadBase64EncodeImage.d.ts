export declare const apiName = "internal.util.uploadBase64EncodeImage";
/**
 * 将base64编码的图片二进制数据转换为mediaId 请求参数定义
 * @apiName internal.util.uploadBase64EncodeImage
 */
export interface IInternalUtilUploadBase64EncodeImageParams {
    /** 标准格式是：data:image/png;base64,xxxxx需要传的是xxxxx的部分 最大值限制：待定 */
    data: string;
    /**
     * image/jpg image/gif image/png image/bmp image/jpeg image/webp
     * audio/amr audio/mp3 video/mp4 audio/wav office/doc office/docx
     * normal/txt file/file
     */
    type: string;
    /** 业务标识，找@存思 申请 */
    bizType: string;
    /**
     * 0，无AUTH
     * 1，STRICT_AUTH, 严格鉴权,下载文件时需要回调业务方进行鉴权，默认值 。
     * 6，CDN_ONLY，公开文件，上传后只可以通过https下载。
     */
    authType: string;
    /**
     * 0, v1版本鉴权（不鉴权）
     * 2, v2版本鉴权（根据authType）
     */
    mediaVersion?: number;
    width?: number;
    height?: number;
    /**
     * 任意唯一字符串，仅当需要进度返回时填写，用于防止同时调用多次上传时channel回调错乱
     */
    sessionId?: number;
}
/**
 * 将base64编码的图片二进制数据转换为mediaId 返回结果定义
 * @apiName internal.util.uploadBase64EncodeImage
 */
export interface IInternalUtilUploadBase64EncodeImageResult {
    sessionId: string;
    /** 若是非Auth的返回这个字段 */
    mediaId?: string;
    /** 若是Auth的返回这个字段 */
    authMediaId?: string;
}
/**
 * 将base64编码的图片二进制数据转换为mediaId
 * @apiName internal.util.uploadBase64EncodeImage
 * @supportVersion pc: 5.1.2
 * @author pc: 伏檀
 */
export declare function uploadBase64EncodeImage$(params: IInternalUtilUploadBase64EncodeImageParams): Promise<IInternalUtilUploadBase64EncodeImageResult>;
export default uploadBase64EncodeImage$;
