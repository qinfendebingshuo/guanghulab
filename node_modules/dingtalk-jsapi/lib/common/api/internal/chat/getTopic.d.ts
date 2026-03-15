export declare const apiName = "internal.chat.getTopic";
/**
 * 根据话题id获取对用的话题 请求参数定义
 * @apiName internal.chat.getTopic
 */
export interface IInternalChatGetTopicParams {
    /** 话题ID (必传，无topicId时传空字符串) */
    topicId: string;
    /** 源消息ID (无topicId时必传) */
    sourceMessageId?: string;
    /** 源消息发送者ID (无topicId时必传) */
    sourceSenderId?: string;
    /** 表情排序类型，1-时间倒序 2-时间顺序 */
    stickerSortType: any;
    /** 回复排序类型，1-时间倒序 2-时间顺序 */
    replySortType: any;
}
/**
 * 根据话题id获取对用的话题 返回结果定义
 * @apiName internal.chat.getTopic
 */
export interface IInternalChatGetTopicResult {
    topicModel: any;
}
/**
 * 根据话题id获取对用的话题
 * @apiName internal.chat.getTopic
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function getTopic$(params: IInternalChatGetTopicParams): Promise<IInternalChatGetTopicResult>;
export default getTopic$;
