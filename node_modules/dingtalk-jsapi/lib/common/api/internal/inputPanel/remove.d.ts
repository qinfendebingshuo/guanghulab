export declare const apiName = "internal.inputPanel.remove";
/**
 * 销毁并移除输入组件 请求参数定义
 * @apiName internal.inputPanel.remove
 */
export interface IInternalInputPanelRemoveParams {
}
/**
 * 销毁并移除输入组件 返回结果定义
 * @apiName internal.inputPanel.remove
 */
export interface IInternalInputPanelRemoveResult {
}
/**
 * 销毁并移除输入组件
 * @apiName internal.inputPanel.remove
 * @supportVersion ios: 4.6.18 android: 4.6.18
 */
export declare function remove$(params: IInternalInputPanelRemoveParams): Promise<IInternalInputPanelRemoveResult>;
export default remove$;
