export declare const apiName = "internal.inputPanel.changeMode";
/**
 * 切换输入模式，文本模式支持拉起键盘。 请求参数定义
 * @apiName internal.inputPanel.changeMode
 */
export interface IInternalInputPanelChangeModeParams {
    /** 必选：使用文本输入模式  */
    text: {
        /** 必选：是否获取焦点，拉起键盘。 */
        focus?: 1 | 0;
        /** 文本At某人 V=(4.6.21,∞] */
        atUsers?: {
            [key: number]: string;
        };
        /** 文本占位符 V=(4.6.21,∞] */
        placeholder?: string;
        /** 文本内容 V=(4.6.21,∞] */
        text: string;
    };
}
/**
 * 切换输入模式，文本模式支持拉起键盘。 返回结果定义
 * @apiName internal.inputPanel.changeMode
 */
export interface IInternalInputPanelChangeModeResult {
    [key: string]: any;
}
/**
 * 切换输入模式，文本模式支持拉起键盘。
 * @apiName internal.inputPanel.changeMode
 * @supportVersion ios: 4.6.18 android: 4.6.18
 */
export declare function changeMode$(params: IInternalInputPanelChangeModeParams): Promise<IInternalInputPanelChangeModeResult>;
export default changeMode$;
