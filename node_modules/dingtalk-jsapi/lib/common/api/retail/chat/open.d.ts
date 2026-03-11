export declare const apiName = "retail.chat.open";
/**
 * 在新零售场景，打开会话 请求参数定义
 * @apiName retail.chat.open
 */
export interface IRetailChatOpenParams {
    [key: string]: any;
}
/**
 * 在新零售场景，打开会话 返回结果定义
 * @apiName retail.chat.open
 */
export interface IRetailChatOpenResult {
    [key: string]: any;
}
/**
 * 在新零售场景，打开会话
 * @apiName retail.chat.open
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function open$(params: IRetailChatOpenParams): Promise<IRetailChatOpenResult>;
export default open$;
