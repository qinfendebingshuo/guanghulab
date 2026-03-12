export declare const apiName = "internal.chat.getDraftAndClear";
/**
 * 获取messageVC输入框中的草稿，并且清空草稿 请求参数定义
 * @apiName internal.chat.getDraftAndClear
 */
export interface IInternalChatGetDraftAndClearParams {
    /** 会话id */
    cid: string;
}
/**
 * 获取messageVC输入框中的草稿，并且清空草稿 返回结果定义
 * @apiName internal.chat.getDraftAndClear
 */
export interface IInternalChatGetDraftAndClearResult {
    /** 输入框内的草稿 */
    draft: string;
    /** at人的列表，{"uid":"nick"}对象 */
    atList?: {
        [uid: string]: string;
    };
}
/**
 * 获取messageVC输入框中的草稿，并且清空草稿
 * @apiName internal.chat.getDraftAndClear
 * @supportVersion ios: 4.7.5 android: 4.7.5
 */
export declare function getDraftAndClear$(params: IInternalChatGetDraftAndClearParams): Promise<IInternalChatGetDraftAndClearResult>;
export default getDraftAndClear$;
