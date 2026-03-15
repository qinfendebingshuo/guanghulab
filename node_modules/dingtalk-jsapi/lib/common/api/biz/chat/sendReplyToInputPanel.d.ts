export declare const apiName = "biz.chat.sendReplyToInputPanel";
/**
 * 发送回复消息文本到会话聊天输入框 请求参数定义
 * @apiName biz.chat.sendReplyToInputPanel
 */
export interface IBizChatSendReplyToInputPanelParams {
    /** 会话id */
    cid?: string;
    /** 消息id */
    mid?: string;
    /** 加密会话id */
    cidEnc?: string;
    /** 回复的加密消息id */
    msgIdEnc?: string;
    /** 回复的内容 */
    replyContent?: string;
    /** 回复的内容 */
    payload?: string;
    /** 想要@的人的uid和昵称 {"uid":"nick"} */
    atOpenIds?: {
        [uid: string]: string;
    };
    /** 想要@的人的dingtalkId和昵称，{"dingtalkId":"nick"} */
    atDingTalkIds?: {
        [dingtalkId: string]: string;
    };
}
/**
 * 发送回复消息文本到会话聊天输入框 返回结果定义
 * @apiName biz.chat.sendReplyToInputPanel
 */
export interface IBizChatSendReplyToInputPanelResult {
}
/**
 * 发送回复消息文本到会话聊天输入框
 * @apiName biz.chat.sendReplyToInputPanel
 * @supportVersion ios: 4.7.12 android: 4.7.12 pc: 4.7.12
 * @author Android: 风沂; iOS: 鱼非; Windows: 仟晨; Mac: 舒绎
 */
export declare function sendReplyToInputPanel$(params: IBizChatSendReplyToInputPanelParams): Promise<IBizChatSendReplyToInputPanelResult>;
export default sendReplyToInputPanel$;
