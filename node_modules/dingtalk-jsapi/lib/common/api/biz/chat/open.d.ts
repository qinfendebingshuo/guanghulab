export declare const apiName = "biz.chat.open";
/**
 * 打开会话 请求参数定义
 * @apiName biz.chat.open
 */
export interface IBizChatOpenParams {
    [key: string]: any;
}
/**
 * 打开会话 返回结果定义
 * @apiName biz.chat.open
 */
export interface IBizChatOpenResult {
    [key: string]: any;
}
/**
 * 打开会话
 * @apiName biz.chat.open
 * @supportVersion  ios: 3.4.0 android: 3.4.0
 */
export declare function open$(params: IBizChatOpenParams): Promise<IBizChatOpenResult>;
export default open$;
