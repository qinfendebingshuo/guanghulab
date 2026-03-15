export declare const apiName = "internal.imshortcut.listFilterMsg";
/**
 * 拉取过滤消息列表 请求参数定义
 * @apiName internal.imshortcut.listFilterMsg
 */
export interface IInternalImshortcutListFilterMsgParams {
    /** 必选 消息过滤器类型 102 红包 103 @我 104 特别关注 105 链接 */
    filterType: number;
    /** 可选 游标 */
    cursor?: string;
    /** 可选 请求个数，不填默认20 */
    count?: number;
}
/**
 * 拉取过滤消息列表 返回结果定义
 * @apiName internal.imshortcut.listFilterMsg
 */
export interface IInternalImshortcutListFilterMsgResult {
    /** 消息的数组，IMJSMessageModel是前端标准消息模型 同动态化IM，细节可找 @龙允(yaohui.lyh) 咨询 */
    msgs: any[];
    /** 下一页的游标 */
    cursor: string;
    /** 是否有下一页数据 */
    hasMore: boolean;
    /** 上次查看时间，单位ms */
    lastViewTime: number;
}
/**
 * 拉取过滤消息列表
 * @apiName internal.imshortcut.listFilterMsg
 * @supportVersion ios: 4.6.37 android: 4.6.37
 */
export declare function listFilterMsg$(params: IInternalImshortcutListFilterMsgParams): Promise<IInternalImshortcutListFilterMsgResult>;
export default listFilterMsg$;
