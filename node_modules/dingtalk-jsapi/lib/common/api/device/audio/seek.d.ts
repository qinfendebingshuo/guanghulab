export declare const apiName = "device.audio.seek";
/**
 * 音频播放跳转 请求参数定义
 * @apiName device.audio.seek
 */
export interface IDeviceAudioSeekParams {
    localAudioId: string;
    position: number;
}
/**
 * 音频播放跳转 返回结果定义
 * @apiName device.audio.seek
 */
export interface IDeviceAudioSeekResult {
    [key: string]: any;
}
/**
 * 音频播放跳转
 * @apiName device.audio.seek
 * @supportVersion  ios: 5.1.20 android: 5.1.20
 */
export declare function seek$(params: IDeviceAudioSeekParams): Promise<IDeviceAudioSeekResult>;
export default seek$;
