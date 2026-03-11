export declare const apiName = "internal.chat.clearDraft";
/**
 * 清空messageVC输入框中的草稿 请求参数定义
 * @apiName internal.chat.clearDraft
 */
export interface IInternalChatClearDraftParams {
    /** 会话id */
    cid: string;
}
/**
 * 清空messageVC输入框中的草稿 返回结果定义
 * @apiName internal.chat.clearDraft
 */
export interface IInternalChatClearDraftResult {
}
/**
 * 清空messageVC输入框中的草稿
 * @apiName internal.chat.clearDraft
 * @supportVersion ios: 4.7.7 android: 4.7.7
 */
export declare function clearDraft$(params: IInternalChatClearDraftParams): Promise<IInternalChatClearDraftResult>;
export default clearDraft$;
