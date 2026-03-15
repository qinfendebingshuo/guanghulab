export declare const apiName = "internal.groupapp.sendMsgAsUser";
/**
 * 群应用以用户身份发消息 请求参数定义
 * @apiName internal.groupapp.sendMsgAsUser
 */
export interface IInternalGroupappSendMsgAsUserParams {
    /** 开放平台用户授权之后的返回 */
    authCode: string;
    /** 开放cid（群插件打开链接参数中获取） */
    openConversationId: string;
    /** 预展示文案 */
    previewText?: string;
    /** 消息模板key */
    messageKey: string;
    /** 息模板中的参数变量值，JSON串 */
    messageParam: string;
}
/**
 * 群应用以用户身份发消息 返回结果定义
 * @apiName internal.groupapp.sendMsgAsUser
 */
export interface IInternalGroupappSendMsgAsUserResult {
}
/**
 * 群应用以用户身份发消息
 * @apiName internal.groupapp.sendMsgAsUser
 * @supportVersion ios: 5.1.6 android: 5.1.6
 * @author Android：峰砺 iOS：木锤
 */
export declare function sendMsgAsUser$(params: IInternalGroupappSendMsgAsUserParams): Promise<IInternalGroupappSendMsgAsUserResult>;
export default sendMsgAsUser$;
