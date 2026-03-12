export declare const apiName = "biz.chat.modifyGroupDesc";
/**
 * 跳转到群简介修改界面修改某个群的群简介 请求参数定义
 * @apiName biz.chat.modifyGroupDesc
 */
export interface IBizChatModifyGroupDescParams {
    [key: string]: any;
}
/**
 * 跳转到群简介修改界面修改某个群的群简介 返回结果定义
 * @apiName biz.chat.modifyGroupDesc
 */
export interface IBizChatModifyGroupDescResult {
    [key: string]: any;
}
/**
 * 跳转到群简介修改界面修改某个群的群简介
 * @apiName biz.chat.modifyGroupDesc
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function modifyGroupDesc$(params: IBizChatModifyGroupDescParams): Promise<IBizChatModifyGroupDescResult>;
export default modifyGroupDesc$;
