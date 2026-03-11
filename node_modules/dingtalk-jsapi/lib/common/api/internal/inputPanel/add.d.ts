export declare const apiName = "internal.inputPanel.add";
/**
 * 初始化输入组件并上屏 请求参数定义
 * @apiName internal.inputPanel.add
 */
export interface IInternalInputPanelAddParams {
    /** 这是占位符  */
    placeholder?: string;
    /** 默认填充文本 */
    text?: string;
    /** 非必选：确认按钮文案 */
    returnKey?: number;
    /** 开启At功能  */
    enableAt?: {
        uids: number[];
        /** 会话id，@时打开群成员列表， V=(4.6.21,∞] */
        cid?: string;
    };
    /** 开启加号入口 */
    enablePlus?: {
        items: Array<{
            title: string;
            iconUrl: string;
        }>;
    };
    /** 开启表情  */
    enableEmotion?: any;
    /** 添加键盘后获取焦点，显示键盘 */
    focus?: boolean;
    /** 提交文字后，保持focus（键盘不管闭） */
    enableKeepFocus?: boolean;
    /** (>= 4.7.8) 指定通知事件通道名称，如不指定，默认为channel.inputPanel 强烈建议指定，避免多个业务同时使用该组件时，错误处理其他业务输入事件 */
    channelNamespace?: string;
    /** (>= 4.6.27) 扩展面板信息 panels: [{panelType:'',panelData:{}}] */
    extension?: any;
    /** (>= 4.7.32) 添加输入框时，是否强制设置键盘支持换行。1表示键盘支持换行，0表示不强制开启，与钉钉设置保持一致。 */
    supportNewLine?: number;
}
/**
 * 初始化输入组件并上屏 返回结果定义
 * @apiName internal.inputPanel.add
 */
export interface IInternalInputPanelAddResult {
}
/**
 * 初始化输入组件并上屏
 * @apiName internal.inputPanel.add
 * @supportVersion ios: 4.6.18 android: 4.6.18
 * @author ios:云信; android:朴文
 */
export declare function add$(params: IInternalInputPanelAddParams): Promise<IInternalInputPanelAddResult>;
export default add$;
