export declare const apiName = "internal.inputPanel.getCurrentInput";
/**
 * 获取native输入面板当前的输入内容 请求参数定义
 * @apiName internal.inputPanel.getCurrentInput
 */
export interface IInternalInputPanelGetCurrentInputParams {
}
/**
 * 获取native输入面板当前的输入内容 返回结果定义
 * @apiName internal.inputPanel.getCurrentInput
 */
export interface IInternalInputPanelGetCurrentInputResult {
    text: string;
    at: {
        [uid: string]: string;
    };
}
/**
 * 获取native输入面板当前的输入内容
 * @apiName internal.inputPanel.getCurrentInput
 * @supportVersion ios: 4.6.42 android: 4.6.42
 */
export declare function getCurrentInput$(params: IInternalInputPanelGetCurrentInputParams): Promise<IInternalInputPanelGetCurrentInputResult>;
export default getCurrentInput$;
