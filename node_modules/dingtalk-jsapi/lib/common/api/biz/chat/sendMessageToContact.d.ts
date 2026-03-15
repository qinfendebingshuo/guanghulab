export declare const apiName = "biz.chat.sendMessageToContact";
/**
 * 发一条消息给联系人 请求参数定义
 * @apiName biz.chat.sendMessageToContact
 */
export interface IBizChatSendMessageToContactParams {
    /** 字符串，联系人类型，默认为空。目前只支值 为"filesHelper"，设置其他或者不设置均为无效。开发者指定 contactType 之后直接发送消息到对应的联系人，不需要拉起联系人选择页面。 */
    contactType?: string;
    /** 消息标题  */
    messageTitle?: string;
    /** 消息图片（支持mediaId和url两种形式） */
    messageImage?: string;
    /** 消息点击跳转的链接 */
    messageHref?: string;
    /** 消息类型: 0 - link消息，取值messageTitle, messageImage，messageHref 1 - 图片消息，取值 messageImage */
    messageType: number;
    /**  bool 值，执行发送后，是否关闭当前webview，默认为 NO，不关闭当前页面。仅在指定有效的 contactType 有用。 */
    closeCurrentPage?: boolean;
    /**  bool 值， 发送消息后，是否跳转到聊天页面。 仅在指定有效的 contactType 有用。 */
    goToConversationPage: boolean;
}
/**
 * 发一条消息给联系人 返回结果定义
 * @apiName biz.chat.sendMessageToContact
 */
export interface IBizChatSendMessageToContactResult {
    [key: string]: any;
}
/**
 * 发一条消息给联系人
 * @apiName biz.chat.sendMessageToContact
 * @supportVersion ios: 4.5.2 android: 4.5.2
 */
export declare function sendMessageToContact$(params: IBizChatSendMessageToContactParams): Promise<IBizChatSendMessageToContactResult>;
export default sendMessageToContact$;
