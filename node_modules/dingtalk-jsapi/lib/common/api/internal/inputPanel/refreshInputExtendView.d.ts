export declare const apiName = "internal.inputPanel.refreshInputExtendView";
/**
 * 刷新输入法扩展面板界面 请求参数定义
 * @apiName internal.inputPanel.refreshInputExtendView
 */
export interface IInternalInputPanelRefreshInputExtendViewParams {
    panels: Array<{
        /** 定义native 扩展面板的类型 */
        panelType: string;
        /** 定义绑定到面板的数据 */
        panelData: any;
    }>;
}
/**
 * 刷新输入法扩展面板界面 返回结果定义
 * @apiName internal.inputPanel.refreshInputExtendView
 */
export interface IInternalInputPanelRefreshInputExtendViewResult {
}
/**
 * 刷新输入法扩展面板界面
 * @apiName internal.inputPanel.refreshInputExtendView
 * @supportVersion ios: 4.7.27 android: 4.7.27
 * @author ios: 文算, android: 长岚
 */
export declare function refreshInputExtendView$(params: IInternalInputPanelRefreshInputExtendViewParams): Promise<IInternalInputPanelRefreshInputExtendViewResult>;
export default refreshInputExtendView$;
