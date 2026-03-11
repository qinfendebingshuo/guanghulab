export declare const apiName = "biz.live.shareToGroup";
/**
 * 分享大直播到某些群 请求参数定义
 * @apiName biz.live.shareToGroup
 */
export interface IBizLiveShareToGroupParams {
    /** 当前群id */
    cid: string;
    /** 直播的uuid */
    liveuuid: string;
    /** 要分享到群的id列表 */
    toCids: string[];
}
/**
 * 分享大直播到某些群 返回结果定义
 * @apiName biz.live.shareToGroup
 */
export interface IBizLiveShareToGroupResult {
    /** 成功的cid列表 */
    successCids: string[];
}
/**
 * 分享大直播到某些群
 * @apiName biz.live.shareToGroup
 * @supportVersion ios: 4.5.5 android: 4.5.5
 */
export declare function shareToGroup$(params: IBizLiveShareToGroupParams): Promise<IBizLiveShareToGroupResult>;
export default shareToGroup$;
