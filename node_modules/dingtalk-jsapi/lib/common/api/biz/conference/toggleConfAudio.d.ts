export declare const apiName = "biz.conference.toggleConfAudio";
/**
 * 新增JSAPI(Android/iOS端), 用于在Android/iOS端的音视频会议模块中，对进行中的会议做音频静音操作 请求参数定义
 * @apiName biz.conference.toggleConfAudio
 */
export interface IBizConferenceToggleConfAudioParams {
    /** true 静音, false 不静音 */
    mute: boolean;
}
/**
 * 新增JSAPI(Android/iOS端), 用于在Android/iOS端的音视频会议模块中，对进行中的会议做音频静音操作 返回结果定义
 * @apiName biz.conference.toggleConfAudio
 */
export interface IBizConferenceToggleConfAudioResult {
}
/**
 * 新增JSAPI(Android/iOS端), 用于在Android/iOS端的音视频会议模块中，对进行中的会议做音频静音操作
 * @apiName biz.conference.toggleConfAudio
 * @supportVersion ios: 5.1.9 android: 5.1.9
 * @author android: 洛洋 ios: 见招
 */
export declare function toggleConfAudio$(params: IBizConferenceToggleConfAudioParams): Promise<IBizConferenceToggleConfAudioResult>;
export default toggleConfAudio$;
