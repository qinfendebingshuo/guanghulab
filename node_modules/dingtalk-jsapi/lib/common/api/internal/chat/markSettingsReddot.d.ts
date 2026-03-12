export declare const apiName = "internal.chat.markSettingsReddot";
/**
 * 标记群设置入口处key对应的红点已消费掉 请求参数定义
 * @apiName internal.chat.markSettingsReddot
 */
export interface IInternalChatMarkSettingsReddotParams {
    key: string;
}
/**
 * 标记群设置入口处key对应的红点已消费掉 返回结果定义
 * @apiName internal.chat.markSettingsReddot
 */
export interface IInternalChatMarkSettingsReddotResult {
}
/**
 * 标记群设置入口处key对应的红点已消费掉
 * @apiName internal.chat.markSettingsReddot
 * @supportVersion ios: 5.0.6 android: 5.0.6
 * @author iOS：济凡；Android：风沂
 */
export declare function markSettingsReddot$(params: IInternalChatMarkSettingsReddotParams): Promise<IInternalChatMarkSettingsReddotResult>;
export default markSettingsReddot$;
