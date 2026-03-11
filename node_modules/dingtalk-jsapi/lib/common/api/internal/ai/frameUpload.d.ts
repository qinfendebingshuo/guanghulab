export declare const apiName = "internal.ai.frameUpload";
/**
 * 上传数据 请求参数定义
 * @apiName internal.ai.frameUpload
 */
export interface IInternalAiFrameUploadParams {
    [key: string]: any;
}
/**
 * 上传数据 返回结果定义
 * @apiName internal.ai.frameUpload
 */
export interface IInternalAiFrameUploadResult {
    [key: string]: any;
}
/**
 * 上传数据
 * @apiName internal.ai.frameUpload
 * @supportVersion ios: 5.1.12 android: 5.1.12
 */
export declare function frameUpload$(params: IInternalAiFrameUploadParams): Promise<IInternalAiFrameUploadResult>;
export default frameUpload$;
