export declare const apiName = "biz.chat.addGroup";
/**
 * 自己加入一个公开群 请求参数定义
 * @apiName biz.chat.addGroup
 */
export interface IBizChatAddGroupParams {
    [key: string]: any;
}
/**
 * 自己加入一个公开群 返回结果定义
 * @apiName biz.chat.addGroup
 */
export interface IBizChatAddGroupResult {
    [key: string]: any;
}
/**
 * 自己加入一个公开群
 * @apiName biz.chat.addGroup
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function addGroup$(params: IBizChatAddGroupParams): Promise<IBizChatAddGroupResult>;
export default addGroup$;
