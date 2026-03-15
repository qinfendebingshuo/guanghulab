export declare const apiName = "biz.live.getPlayerPosition";
/**
 * 当前正在进行直播回放时调用该jsapi，获取到当前播放的时长，单位为秒(S)，用于后续再次播放时从该位置开始播放 请求参数定义
 * @apiName biz.live.getPlayerPosition
 */
export interface IBizLiveGetPlayerPositionParams {
}
/**
 * 当前正在进行直播回放时调用该jsapi，获取到当前播放的时长，单位为秒(S)，用于后续再次播放时从该位置开始播放 返回结果定义
 * @apiName biz.live.getPlayerPosition
 */
export interface IBizLiveGetPlayerPositionResult {
    /** 当前播放时长，单位为秒 */
    position: number;
}
/**
 * 当前正在进行直播回放时调用该jsapi，获取到当前播放的时长，单位为秒(S)，用于后续再次播放时从该位置开始播放
 * @apiName biz.live.getPlayerPosition
 * @supportVersion ios: 4.7.11 android: 4.7.11
 * @author iOS: 钧鸿; Android: 倾池
 */
export declare function getPlayerPosition$(params: IBizLiveGetPlayerPositionParams): Promise<IBizLiveGetPlayerPositionResult>;
export default getPlayerPosition$;
