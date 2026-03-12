export declare const apiName = "internal.chat.setHasRichTextDraft";
/**
 * 设置是否富文本有富文本草稿，用于显示红点 请求参数定义
 * @apiName internal.chat.setHasRichTextDraft
 */
export interface IInternalChatSetHasRichTextDraftParams {
    /** 会话id */
    cid: string;
    /** 是否有富文本草稿，默认否 */
    hasRichTextDraft?: boolean;
}
/**
 * 设置是否富文本有富文本草稿，用于显示红点 返回结果定义
 * @apiName internal.chat.setHasRichTextDraft
 */
export interface IInternalChatSetHasRichTextDraftResult {
}
/**
 * 设置是否富文本有富文本草稿，用于显示红点
 * @apiName internal.chat.setHasRichTextDraft
 * @supportVersion ios: 4.7.5 android: 4.7.5
 */
export declare function setHasRichTextDraft$(params: IInternalChatSetHasRichTextDraftParams): Promise<IInternalChatSetHasRichTextDraftResult>;
export default setHasRichTextDraft$;
