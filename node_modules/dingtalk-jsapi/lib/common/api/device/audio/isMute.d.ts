export declare const apiName = "device.audio.isMute";
/**
 * 获取当前播放器静音状态 请求参数定义
 * @apiName device.audio.isMute
 */
export interface IDeviceAudioIsMuteParams {
}
/**
 * 获取当前播放器静音状态 返回结果定义
 * @apiName device.audio.isMute
 */
export interface IDeviceAudioIsMuteResult {
    /** true 表示静音 false表示未静音 */
    isMute: boolean;
}
/**
 * 获取当前播放器静音状态
 * @apiName device.audio.isMute
 * @supportVersion ios: 5.1.18 android: 5.1.18
 * @author iOS：新鹏 Android：峰砺
 */
export declare function isMute$(params: IDeviceAudioIsMuteParams): Promise<IDeviceAudioIsMuteResult>;
export default isMute$;
