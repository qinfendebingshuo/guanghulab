export declare const apiName = "biz.live.getAllLiveList";
/**
 * 获取当前正在进行的直播 请求参数定义
 * @apiName biz.live.getAllLiveList
 */
export interface IBizLiveGetAllLiveListParams {
}
/**
 * 获取当前正在进行的直播 返回结果定义
 * @apiName biz.live.getAllLiveList
 */
export declare type IBizLiveGetAllLiveListResult = Array<{
    /** 群id */
    cid: string;
    /** 群名称 */
    cidName: string;
    /** 直播uuid */
    liveUuid: string;
    /** 直播标题 */
    title: string;
    /** 直播封面图 */
    coverUrl: string;
}>;
/**
 * 获取当前正在进行的直播
 * @apiName biz.live.getAllLiveList
 * @supportVersion ios: 4.5.16 android: 4.5.16 pc: 4.5.16
 */
export declare function getAllLiveList$(params: IBizLiveGetAllLiveListParams): Promise<IBizLiveGetAllLiveListResult>;
export default getAllLiveList$;
