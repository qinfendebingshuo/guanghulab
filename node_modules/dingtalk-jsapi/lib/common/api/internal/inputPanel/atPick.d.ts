export declare const apiName = "internal.inputPanel.atPick";
/**
 * 获取At可选人员uid列表后，弹出At选人界面。 请求参数定义
 * @apiName internal.inputPanel.atPick
 */
export interface IInternalInputPanelAtPickParams {
    /** 必选： @可选人列表 */
    uids: number[];
}
/**
 * 获取At可选人员uid列表后，弹出At选人界面。 返回结果定义
 * @apiName internal.inputPanel.atPick
 */
export interface IInternalInputPanelAtPickResult {
}
/**
 * 获取At可选人员uid列表后，弹出At选人界面。
 * @apiName internal.inputPanel.atPick
 * @supportVersion ios: 4.6.18 android: 4.6.18
 */
export declare function atPick$(params: IInternalInputPanelAtPickParams): Promise<IInternalInputPanelAtPickResult>;
export default atPick$;
