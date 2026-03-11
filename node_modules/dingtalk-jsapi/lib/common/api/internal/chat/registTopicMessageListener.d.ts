export declare const apiName = "internal.chat.registTopicMessageListener";
/**
 * 注册话题相关的消息变更通知 请求参数定义
 * @apiName internal.chat.registTopicMessageListener
 */
export interface IInternalChatRegistTopicMessageListenerParams {
    /**  话题id */
    topicId: number;
}
/**
 * 注册话题相关的消息变更通知 返回结果定义
 * @apiName internal.chat.registTopicMessageListener
 */
export interface IInternalChatRegistTopicMessageListenerResult {
}
/**
 * 注册话题相关的消息变更通知
 * @apiName internal.chat.registTopicMessageListener
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function registTopicMessageListener$(params: IInternalChatRegistTopicMessageListenerParams): Promise<IInternalChatRegistTopicMessageListenerResult>;
export default registTopicMessageListener$;
