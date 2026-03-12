export declare const apiName = "biz.chat.chooseConversation";
/**
 * 选会话 请求参数定义
 * @apiName biz.chat.chooseConversation
 */
export interface IBizChatChooseConversationParams {
    [key: string]: any;
}
/**
 * 选会话 返回结果定义
 * @apiName biz.chat.chooseConversation
 */
export interface IBizChatChooseConversationResult {
    [key: string]: any;
}
/**
 * 选会话
 * @apiName biz.chat.chooseConversation
 * @supportVersion  pc: 2.7.0 ios: 2.4.0 android: 2.4.0
 */
export declare function chooseConversation$(params: IBizChatChooseConversationParams): Promise<IBizChatChooseConversationResult>;
export default chooseConversation$;
