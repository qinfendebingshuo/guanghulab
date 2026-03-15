export declare const apiName = "biz.live.getLiveFuncMsgs";
/**
 * 拉群群直播功能会话消息 请求参数定义
 * @apiName biz.live.getLiveFuncMsgs
 */
export interface IBizLiveGetLiveFuncMsgsParams {
    /** 向前拉取 */
    forward: any;
    /** 拉取位置 */
    cursor: any;
    /** 消息个数 */
    size: number;
}
/**
 * 拉群群直播功能会话消息 返回结果定义
 * @apiName biz.live.getLiveFuncMsgs
 */
export declare type IBizLiveGetLiveFuncMsgsResult = Array<{
    text: string;
    extension: {
        liveEntryType: string;
        coverUrl: string;
        title: string;
        timeStamp: any;
        nick: string;
        uuid: string;
        anchorId: string;
        cid: string;
        conversationTitle: string;
    };
}>;
/**
 * 拉群群直播功能会话消息
 * @apiName biz.live.getLiveFuncMsgs
 * @supportVersion ios: 4.6.10 android: 4.6.10
 */
export declare function getLiveFuncMsgs$(params: IBizLiveGetLiveFuncMsgsParams): Promise<IBizLiveGetLiveFuncMsgsResult>;
export default getLiveFuncMsgs$;
