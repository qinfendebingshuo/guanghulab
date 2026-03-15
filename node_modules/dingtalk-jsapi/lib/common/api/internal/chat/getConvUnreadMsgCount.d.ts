export declare const apiName = "internal.chat.getConvUnreadMsgCount";
/**
 * 功能描述获取对应会话的未读消息数量 请求参数定义
 * @apiName internal.chat.getConvUnreadMsgCount
 */
export interface IInternalChatGetConvUnreadMsgCountParams {
    cid: string;
}
/**
 * 功能描述获取对应会话的未读消息数量 返回结果定义
 * @apiName internal.chat.getConvUnreadMsgCount
 */
export interface IInternalChatGetConvUnreadMsgCountResult {
    count: number;
}
/**
 * 功能描述获取对应会话的未读消息数量
 * @apiName internal.chat.getConvUnreadMsgCount
 * @supportVersion ios: 4.6.27 android: 4.6.27
 */
export declare function getConvUnreadMsgCount$(params: IInternalChatGetConvUnreadMsgCountParams): Promise<IInternalChatGetConvUnreadMsgCountResult>;
export default getConvUnreadMsgCount$;
