export declare const apiName = "internal.chat.getDraft";
/**
 * 获取messageVC输入框中的草稿 请求参数定义
 * @apiName internal.chat.getDraft
 */
export interface IInternalChatGetDraftParams {
    /** 会话id */
    cid: string;
}
/**
 * 获取messageVC输入框中的草稿 返回结果定义
 * @apiName internal.chat.getDraft
 */
export interface IInternalChatGetDraftResult {
    /** 输入框内的草稿 */
    draft: string;
    /** at人的列表，{"uid":"nick"}对象 */
    atList: {
        [uid: string]: string;
    };
}
/**
 * 获取messageVC输入框中的草稿
 * @apiName internal.chat.getDraft
 * @supportVersion ios: 4.7.7 android: 4.7.7
 */
export declare function getDraft$(params: IInternalChatGetDraftParams): Promise<IInternalChatGetDraftResult>;
export default getDraft$;
