export declare const apiName = "internal.chat.getTopicReplys";
/**
 * 获取话题的回复列表 请求参数定义
 * @apiName internal.chat.getTopicReplys
 */
export interface IInternalChatGetTopicReplysParams {
    /** 话题id */
    topicId: any;
    /** 每页大小 */
    pageSize: any;
    /** 最后一条记录的时间 */
    lastCreateAt: any;
    /** 排序类型 */
    sortType: any;
}
/**
 * 获取话题的回复列表 返回结果定义
 * @apiName internal.chat.getTopicReplys
 */
export interface IInternalChatGetTopicReplysResult {
    topicReplyListModel: any;
}
/**
 * 获取话题的回复列表
 * @apiName internal.chat.getTopicReplys
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function getTopicReplys$(params: IInternalChatGetTopicReplysParams): Promise<IInternalChatGetTopicReplysResult>;
export default getTopicReplys$;
