export declare const apiName = "internal.chat.stickerReply";
/**
 * 表情回复接口 请求参数定义
 * @apiName internal.chat.stickerReply
 */
export interface IInternalChatStickerReplyParams {
    /** 话题消息id */
    sourceMessageId: any;
    /** 话题消息发送者id */
    sourceSenderId: any;
    /** 表情类型 */
    stickerType: any;
    /** 是否为取消点赞 */
    isRecall?: boolean;
}
/**
 * 表情回复接口 返回结果定义
 * @apiName internal.chat.stickerReply
 */
export interface IInternalChatStickerReplyResult {
}
/**
 * 表情回复接口
 * @apiName internal.chat.stickerReply
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function stickerReply$(params: IInternalChatStickerReplyParams): Promise<IInternalChatStickerReplyResult>;
export default stickerReply$;
