export declare const apiName = "internal.inputPanel.resignInput";
/**
 * 结束当前输入状态，恢复输入框。 请求参数定义
 * @apiName internal.inputPanel.resignInput
 */
export interface IInternalInputPanelResignInputParams {
}
/**
 * 结束当前输入状态，恢复输入框。 返回结果定义
 * @apiName internal.inputPanel.resignInput
 */
export interface IInternalInputPanelResignInputResult {
}
/**
 * 结束当前输入状态，恢复输入框。
 * @apiName internal.inputPanel.resignInput
 * @supportVersion ios: 4.6.18 android: 4.6.18
 */
export declare function resignInput$(params: IInternalInputPanelResignInputParams): Promise<IInternalInputPanelResignInputResult>;
export default resignInput$;
