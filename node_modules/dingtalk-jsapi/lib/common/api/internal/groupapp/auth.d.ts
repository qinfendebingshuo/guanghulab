export declare const apiName = "internal.groupapp.auth";
/**
 * 群应用授权 请求参数定义
 * @apiName internal.groupapp.auth
 */
export interface IInternalGroupappAuthParams {
    /** 开放平台用户授权之后的返回 */
    authCode: string;
    /** 开放cid（群插件打开链接参数中获取） */
    openConversationId: string;
}
/**
 * 群应用授权 返回结果定义
 * @apiName internal.groupapp.auth
 */
export interface IInternalGroupappAuthResult {
}
/**
 * 群应用授权
 * @apiName internal.groupapp.auth
 * @supportVersion ios: 5.1.6 android: 5.1.6
 * @author Android：峰砺 iOS：木锤
 */
export declare function auth$(params: IInternalGroupappAuthParams): Promise<IInternalGroupappAuthResult>;
export default auth$;
