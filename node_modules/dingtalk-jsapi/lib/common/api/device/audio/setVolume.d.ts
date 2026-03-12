export declare const apiName = "device.audio.setVolume";
/**
 * 设置当前播放器音量 请求参数定义
 * @apiName device.audio.setVolume
 */
export interface IDeviceAudioSetVolumeParams {
    /** 音量，取值范围[0, 1] */
    volume: number;
}
/**
 * 设置当前播放器音量 返回结果定义
 * @apiName device.audio.setVolume
 */
export interface IDeviceAudioSetVolumeResult {
}
/**
 * 设置当前播放器音量
 * @apiName device.audio.setVolume
 * @supportVersion ios: 5.1.18 android: 5.1.18
 * @author iOS：新鹏 Android：峰砺
 */
export declare function setVolume$(params: IDeviceAudioSetVolumeParams): Promise<IDeviceAudioSetVolumeResult>;
export default setVolume$;
