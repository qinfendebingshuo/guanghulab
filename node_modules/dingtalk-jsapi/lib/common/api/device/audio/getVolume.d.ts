export declare const apiName = "device.audio.getVolume";
/**
 * 获取当前播放器音量 请求参数定义
 * @apiName device.audio.getVolume
 */
export interface IDeviceAudioGetVolumeParams {
}
/**
 * 获取当前播放器音量 返回结果定义
 * @apiName device.audio.getVolume
 */
export interface IDeviceAudioGetVolumeResult {
    /** 音量，取值范围[0, 1] */
    volume: number;
}
/**
 * 获取当前播放器音量
 * @apiName device.audio.getVolume
 * @supportVersion ios: 5.1.18 android: 5.1.18
 * @author iOS：新鹏 Android：峰砺
 */
export declare function getVolume$(params: IDeviceAudioGetVolumeParams): Promise<IDeviceAudioGetVolumeResult>;
export default getVolume$;
