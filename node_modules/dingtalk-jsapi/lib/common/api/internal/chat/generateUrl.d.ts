export declare const apiName = "internal.chat.generateUrl";
/**
 * 通过mediaId换取缩略图，大图，原图url 请求参数定义
 * @apiName internal.chat.generateUrl
 */
export interface IInternalChatGenerateUrlParams {
    /** mediaId列表 */
    mediaIds: string[];
}
/**
 * 通过mediaId换取缩略图，大图，原图url 返回结果定义
 * @apiName internal.chat.generateUrl
 */
export interface IInternalChatGenerateUrlResult {
    [mediaId: string]: {
        originalUrl: string;
        bigUrl: string;
        thumbUrl: string;
    };
}
/**
 * 通过mediaId换取缩略图，大图，原图url
 * @apiName internal.chat.generateUrl
 * @supportVersion ios: 4.7.5 android: 4.7.5
 */
export declare function generateUrl$(params: IInternalChatGenerateUrlParams): Promise<IInternalChatGenerateUrlResult>;
export default generateUrl$;
