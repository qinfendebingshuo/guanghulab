export declare const apiName = "biz.live.playerSeekTo";
/**
 * 用于前端指定直播回放播放器当前播放位置，这样下次播放时可以从上次播放的位置开始，不需要重头播放 请求参数定义
 * @apiName biz.live.playerSeekTo
 */
export interface IBizLivePlayerSeekToParams {
    /** 当前播放时长，单位为秒 */
    position: number;
}
/**
 * 用于前端指定直播回放播放器当前播放位置，这样下次播放时可以从上次播放的位置开始，不需要重头播放 返回结果定义
 * @apiName biz.live.playerSeekTo
 */
export interface IBizLivePlayerSeekToResult {
}
/**
 * 用于前端指定直播回放播放器当前播放位置，这样下次播放时可以从上次播放的位置开始，不需要重头播放
 * @apiName biz.live.playerSeekTo
 * @supportVersion ios: 4.7.11 android: 4.7.11
 * @author iOS: 钧鸿; Android: 倾池
 */
export declare function playerSeekTo$(params: IBizLivePlayerSeekToParams): Promise<IBizLivePlayerSeekToResult>;
export default playerSeekTo$;
