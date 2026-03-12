export declare const apiName = "internal.chat.getTopicStickers";
/**
 * 获取话题回复的表情列表 请求参数定义
 * @apiName internal.chat.getTopicStickers
 */
export interface IInternalChatGetTopicStickersParams {
    /** 话题id */
    topicId: any;
    /** 表情类型 */
    stickerType: any;
    /** 每页大小 */
    pageSize: any;
    /** 最后一条记录的时间 */
    lastCreateAt: any;
    /** 排序类型 */
    sortType: any;
}
/**
 * 获取话题回复的表情列表 返回结果定义
 * @apiName internal.chat.getTopicStickers
 */
export interface IInternalChatGetTopicStickersResult {
    /** 话题回复表情list对应的数据 */
    topicStickerListModel: any;
}
/**
 * 获取话题回复的表情列表
 * @apiName internal.chat.getTopicStickers
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function getTopicStickers$(params: IInternalChatGetTopicStickersParams): Promise<IInternalChatGetTopicStickersResult>;
export default getTopicStickers$;
