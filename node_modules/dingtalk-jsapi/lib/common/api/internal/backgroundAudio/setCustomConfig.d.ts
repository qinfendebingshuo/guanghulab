export declare const apiName = "internal.backgroundAudio.setCustomConfig";
/**
 * 设置后台音乐自定义配置，在setSrc之后调用。 请求参数定义
 * @apiName internal.backgroundAudio.setCustomConfig
 */
export interface IInternalBackgroundAudioSetCustomConfigParams {
    /** 隐藏首页横条入口 true表示隐藏 false表示不隐藏 */
    hideBanner?: boolean;
    /** 是否启用后台播放 true表示启用 iOS版本会出现在锁屏页面，一首歌曲播放完成后应用不会被系统挂起 false表示不启用 */
    enableBackground?: boolean;
}
/**
 * 设置后台音乐自定义配置，在setSrc之后调用。 返回结果定义
 * @apiName internal.backgroundAudio.setCustomConfig
 */
export interface IInternalBackgroundAudioSetCustomConfigResult {
}
/**
 * 设置后台音乐自定义配置，在setSrc之后调用。
 * @apiName internal.backgroundAudio.setCustomConfig
 * @supportVersion ios: 5.1.18 android: 5.1.18
 * @author iOS：新鹏 Android：峰砺
 */
export declare function setCustomConfig$(params: IInternalBackgroundAudioSetCustomConfigParams): Promise<IInternalBackgroundAudioSetCustomConfigResult>;
export default setCustomConfig$;
