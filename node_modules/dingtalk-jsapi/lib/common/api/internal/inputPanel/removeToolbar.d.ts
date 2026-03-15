export declare const apiName = "internal.inputPanel.removeToolbar";
/**
 * 移除输入工具条 请求参数定义
 * @apiName internal.inputPanel.removeToolbar
 */
export interface IInternalInputPanelRemoveToolbarParams {
}
/**
 * 移除输入工具条 返回结果定义
 * @apiName internal.inputPanel.removeToolbar
 */
export interface IInternalInputPanelRemoveToolbarResult {
}
/**
 * 移除输入工具条
 * @apiName internal.inputPanel.removeToolbar
 * @supportVersion ios: 5.0.8 android: 5.0.8
 * @author Android:朴文, iOS: 文算
 */
export declare function removeToolbar$(params: IInternalInputPanelRemoveToolbarParams): Promise<IInternalInputPanelRemoveToolbarResult>;
export default removeToolbar$;
