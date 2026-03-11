export declare const apiName = "internal.chat.getRichTextPayload";
/**
 * 获取被撤回的富文本消息的payload 请求参数定义
 * @apiName internal.chat.getRichTextPayload
 */
export interface IInternalChatGetRichTextPayloadParams {
    /** 消息所属的会话id */
    cid: string;
    /** 消息id */
    mid: number;
}
/**
 * 获取被撤回的富文本消息的payload 返回结果定义
 * @apiName internal.chat.getRichTextPayload
 */
export interface IInternalChatGetRichTextPayloadResult {
    payload: string;
}
/**
 * 获取被撤回的富文本消息的payload
 * @apiName internal.chat.getRichTextPayload
 * @supportVersion ios: 4.7.10 android: 4.7.10
 * @author Android:卧岩; iOS: 新鹏
 */
export declare function getRichTextPayload$(params: IInternalChatGetRichTextPayloadParams): Promise<IInternalChatGetRichTextPayloadResult>;
export default getRichTextPayload$;
