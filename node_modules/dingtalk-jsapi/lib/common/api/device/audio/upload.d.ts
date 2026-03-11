export declare const apiName = "device.audio.upload";
/**
 * 上传已录制的音频 请求参数定义
 * @apiName device.audio.upload
 */
export interface IDeviceAudioUploadParams {
    [key: string]: any;
}
/**
 * 上传已录制的音频 返回结果定义
 * @apiName device.audio.upload
 */
export interface IDeviceAudioUploadResult {
    [key: string]: any;
}
/**
 * 上传已录制的音频
 * @apiName device.audio.upload
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function upload$(params: IDeviceAudioUploadParams): Promise<IDeviceAudioUploadResult>;
export default upload$;
