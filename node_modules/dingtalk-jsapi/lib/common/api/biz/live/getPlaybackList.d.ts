export declare const apiName = "biz.live.getPlaybackList";
/**
 * 获取回放 请求参数定义
 * @apiName biz.live.getPlaybackList
 */
export interface IBizLiveGetPlaybackListParams {
    /** 页码 */
    page: number;
    /** 每页容量 */
    page_size: number;
    /** 筛选类型(0 我未看的, 1 我看过的, 2 全部, 3 我发起的) */
    searchType: number;
}
/**
 * 获取回放 返回结果定义
 * @apiName biz.live.getPlaybackList
 */
export interface IBizLiveGetPlaybackListResult {
    records: Array<{
        anchorId: string;
        liveUuid: string;
        title: string;
        coverUrl: string;
        playUrl: string;
        status: number;
        datetime: string;
        duration: number;
        key: string;
        hasWatched: boolean;
        liveType: number;
        isLiveAbord: number;
        conversationName: string;
        pv: number;
        praiseCount: number;
        largeCoverUrl: string;
    }>;
    ended: boolean;
}
/**
 * 获取回放
 * @apiName biz.live.getPlaybackList
 * @supportVersion ios: 4.5.16 android: 4.5.16 pc: 4.5.16
 */
export declare function getPlaybackList$(params: IBizLiveGetPlaybackListParams): Promise<IBizLiveGetPlaybackListResult>;
export default getPlaybackList$;
