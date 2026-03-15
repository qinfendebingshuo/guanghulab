export declare const apiName = "internal.imshortcut.updateMsgFilterStatus";
/**
 * 更新消息捷径设置项开关状态 请求参数定义
 * @apiName internal.imshortcut.updateMsgFilterStatus
 */
export interface IInternalImshortcutUpdateMsgFilterStatusParams {
    /** 设置项id */
    itemId: number;
    /** 开关状态  */
    status: number;
    syncVersion?: number;
}
/**
 * 更新消息捷径设置项开关状态 返回结果定义
 * @apiName internal.imshortcut.updateMsgFilterStatus
 */
export interface IInternalImshortcutUpdateMsgFilterStatusResult {
    /** 状态码，0表示成功，其他是失败 */
    retCode: number;
    /** 失败原因 */
    errorMsg: string;
    /** 更新后的配置 */
    configs: Array<{
        /** 设置项id */
        itemId: number;
        /** 设置项icon */
        iconFont: string;
        /** 设置项前景颜色 */
        iconColor: string;
        /** 设置项背景颜色 */
        iconBgColor: string;
        /** 标题 */
        title: string;
        /** 数据版本 */
        syncVersion: number;
        /** 开关状态 */
        status: number;
        /** 提示文案 */
        tooltip: string;
    }>;
}
/**
 * 更新消息捷径设置项开关状态
 * @apiName internal.imshortcut.updateMsgFilterStatus
 * @supportVersion ios: 4.6.37 android: 4.6.37
 */
export declare function updateMsgFilterStatus$(params: IInternalImshortcutUpdateMsgFilterStatusParams): Promise<IInternalImshortcutUpdateMsgFilterStatusResult>;
export default updateMsgFilterStatus$;
