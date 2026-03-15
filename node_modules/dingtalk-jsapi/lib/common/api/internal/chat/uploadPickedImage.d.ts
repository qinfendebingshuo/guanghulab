export declare const apiName = "internal.chat.uploadPickedImage";
/**
 * 上传图片 请求参数定义
 * @apiName internal.chat.uploadPickedImage
 */
export interface IInternalChatUploadPickedImageParams {
    /** localMediaId, pickImage接口里返回 */
    localMediaId: string;
}
/**
 * 上传图片 返回结果定义
 * @apiName internal.chat.uploadPickedImage
 */
export declare type IInternalChatUploadPickedImageResult = string;
/**
 * 上传图片
 * @apiName internal.chat.uploadPickedImage
 * @supportVersion ios: 4.7.5 android: 4.7.5
 */
export declare function uploadPickedImage$(params: IInternalChatUploadPickedImageParams): Promise<IInternalChatUploadPickedImageResult>;
export default uploadPickedImage$;
