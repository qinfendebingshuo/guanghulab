export declare const apiName = "biz.chat.getConversationInfo";
/**
 * 查询会话信息 请求参数定义
 * @apiName biz.chat.getConversationInfo
 */
export interface IBizChatGetConversationInfoParams {
    [key: string]: any;
}
/**
 * 查询会话信息 返回结果定义
 * @apiName biz.chat.getConversationInfo
 */
export interface IBizChatGetConversationInfoResult {
    /** 会话状态：0:正常,1:隐藏,2:退出,3:被踢,4:解散 （移动端 4.6.37 开始支持） */
    status?: number;
    [key: string]: any;
}
/**
 * 查询会话信息
 * @apiName biz.chat.getConversationInfo
 * @supportVersion  ios: 2.4.0 android: 2.4.0
 */
export declare function getConversationInfo$(params: IBizChatGetConversationInfoParams): Promise<IBizChatGetConversationInfoResult>;
export default getConversationInfo$;
