export declare const apiName = "internal.inputPanel.addToolBar";
/**
 * 输入组件支持工具栏， 工具栏可定制 请求参数定义
 * @apiName internal.inputPanel.addToolBar
 */
export interface IInternalInputPanelAddToolBarParams {
    toolbarConfig: {
        items: Array<{
            /**  -1 默认id，标识表情 */
            id?: number;
            /** iconfont枚举，目前仅支持emotion, camera, pic, cspace， 优先级高于iconUrl */
            iconName?: string;
            /**  自定义icon */
            iconUrl?: string;
            /** 工具名称 */
            name?: string;
        }>;
    };
}
/**
 * 输入组件支持工具栏， 工具栏可定制 返回结果定义
 * @apiName internal.inputPanel.addToolBar
 */
export interface IInternalInputPanelAddToolBarResult {
}
/**
 * 输入组件支持工具栏， 工具栏可定制
 * @apiName internal.inputPanel.addToolBar
 * @supportVersion ios: 5.0.8 android: 5.0.8
 * @author Android:朴文, iOS: 文算
 */
export declare function addToolBar$(params: IInternalInputPanelAddToolBarParams): Promise<IInternalInputPanelAddToolBarResult>;
export default addToolBar$;
