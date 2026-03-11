export declare const apiName = "device.audio.getDuration";
/**
 * 获取音频长度 请求参数定义
 * @apiName device.audio.getDuration
 */
export interface IDeviceAudioGetDurationParams {
    localAudioId: string;
}
/**
 * 获取音频长度 返回结果定义
 * @apiName device.audio.getDuration
 */
export interface IDeviceAudioGetDurationResult {
    duration: number;
}
/**
 * 获取音频长度
 * @apiName device.audio.getDuration
 * @supportVersion  ios: 5.1.20 android: 5.1.20
 */
export declare function getDuration$(params: IDeviceAudioGetDurationParams): Promise<IDeviceAudioGetDurationResult>;
export default getDuration$;
