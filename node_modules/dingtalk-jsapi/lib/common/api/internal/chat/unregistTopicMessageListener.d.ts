export declare const apiName = "internal.chat.unregistTopicMessageListener";
/**
 * 反注册话题消息变更通知 请求参数定义
 * @apiName internal.chat.unregistTopicMessageListener
 */
export interface IInternalChatUnregistTopicMessageListenerParams {
}
/**
 * 反注册话题消息变更通知 返回结果定义
 * @apiName internal.chat.unregistTopicMessageListener
 */
export interface IInternalChatUnregistTopicMessageListenerResult {
}
/**
 * 反注册话题消息变更通知
 * @apiName internal.chat.unregistTopicMessageListener
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function unregistTopicMessageListener$(params: IInternalChatUnregistTopicMessageListenerParams): Promise<IInternalChatUnregistTopicMessageListenerResult>;
export default unregistTopicMessageListener$;
