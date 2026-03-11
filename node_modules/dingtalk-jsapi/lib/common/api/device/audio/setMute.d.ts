export declare const apiName = "device.audio.setMute";
/**
 * 设置当前播放器静音 请求参数定义
 * @apiName device.audio.setMute
 */
export interface IDeviceAudioSetMuteParams {
    /** 是否静音 true 表示静音 false表示取消静音 */
    mute: boolean;
}
/**
 * 设置当前播放器静音 返回结果定义
 * @apiName device.audio.setMute
 */
export interface IDeviceAudioSetMuteResult {
}
/**
 * 设置当前播放器静音
 * @apiName device.audio.setMute
 * @supportVersion ios: 5.1.18 android: 5.1.18
 * @author iOS：新鹏 Android：峰砺
 */
export declare function setMute$(params: IDeviceAudioSetMuteParams): Promise<IDeviceAudioSetMuteResult>;
export default setMute$;
