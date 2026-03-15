export declare const apiName = "internal.imshortcut.initEventChannel";
/**
 * 初始化消息捷径事件通道，事件通道初始化之后，才会收到后续的各种消息/群状态的变更。 请求参数定义
 * @apiName internal.imshortcut.initEventChannel
 */
export interface IInternalImshortcutInitEventChannelParams {
    /** 消息过滤器类型 102 红包 103 @我 104 特别关注 105 链接 */
    filterType: number;
}
/**
 * 初始化消息捷径事件通道，事件通道初始化之后，才会收到后续的各种消息/群状态的变更。 返回结果定义
 * @apiName internal.imshortcut.initEventChannel
 */
export interface IInternalImshortcutInitEventChannelResult {
}
/**
 * 初始化消息捷径事件通道，事件通道初始化之后，才会收到后续的各种消息/群状态的变更。
 * @apiName internal.imshortcut.initEventChannel
 * @supportVersion ios: 4.6.37 android: 4.6.37
 */
export declare function initEventChannel$(params: IInternalImshortcutInitEventChannelParams): Promise<IInternalImshortcutInitEventChannelResult>;
export default initEventChannel$;
