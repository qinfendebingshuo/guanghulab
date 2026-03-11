export declare const apiName = "internal.imshortcut.getMsgFilterConfigDetail";
/**
 * 拉取消息捷径设置页列表数据 请求参数定义
 * @apiName internal.imshortcut.getMsgFilterConfigDetail
 */
export interface IInternalImshortcutGetMsgFilterConfigDetailParams {
}
/**
 * 拉取消息捷径设置页列表数据 返回结果定义
 * @apiName internal.imshortcut.getMsgFilterConfigDetail
 */
export interface IInternalImshortcutGetMsgFilterConfigDetailResult {
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
 * 拉取消息捷径设置页列表数据
 * @apiName internal.imshortcut.getMsgFilterConfigDetail
 * @supportVersion ios: 4.6.37 android: 4.6.37
 */
export declare function getMsgFilterConfigDetail$(params: IInternalImshortcutGetMsgFilterConfigDetailParams): Promise<IInternalImshortcutGetMsgFilterConfigDetailResult>;
export default getMsgFilterConfigDetail$;
