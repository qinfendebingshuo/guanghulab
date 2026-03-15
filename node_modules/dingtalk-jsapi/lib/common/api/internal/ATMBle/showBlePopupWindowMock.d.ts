export declare const apiName = "internal.ATMBle.showBlePopupWindowMock";
/**
 * 蓝牙打卡弹窗样式显示，只做展示用，会返回各种点击及消失事件。 请求参数定义
 * @apiName internal.ATMBle.showBlePopupWindowMock
 */
export interface IInternalATMBleShowBlePopupWindowMockParams {
    /** 目前现有打卡优先级，优先级从低到高 0-普通二次确认弹窗 1-人脸识别二次确认弹窗 2-打卡结果弹窗 因此建议设置为低于上述打卡优先级 */
    priority?: number;
    /** 弹窗最上方标题，建议给定值，如“考勤” */
    spaceTitle?: string;
    title: string;
    content: string;
    showTag?: boolean;
    /** 标题后的标签内容，可设置如“早退”； 只有当showTag为true时才生效 */
    tagContent?: string;
    /** icon，mediaId */
    icon?: string;
    /** 是否显示弹窗右上角"X" */
    showCancel?: boolean;
    /** 左边幽灵按钮文本，null或者空字符串时不显示按钮 */
    leftButton?: string;
    /** 右边填充按钮文本，null或者空字符串时不显示按钮 */
    rightButton?: string;
}
/**
 * 蓝牙打卡弹窗样式显示，只做展示用，会返回各种点击及消失事件。 返回结果定义
 * @apiName internal.ATMBle.showBlePopupWindowMock
 */
export interface IInternalATMBleShowBlePopupWindowMockResult {
    /** -1 - 未知  0 - 右上角"X"点击  1 - 左边幽灵按钮点击  2 - 右边填充按钮点击  3 - 取消，包含消失与上滑取消 */
    result: number;
}
/**
 * 蓝牙打卡弹窗样式显示，只做展示用，会返回各种点击及消失事件。
 * @apiName internal.ATMBle.showBlePopupWindowMock
 * @supportVersion android: 4.7.27
 * @author Android：序望
 */
export declare function showBlePopupWindowMock$(params: IInternalATMBleShowBlePopupWindowMockParams): Promise<IInternalATMBleShowBlePopupWindowMockResult>;
export default showBlePopupWindowMock$;
