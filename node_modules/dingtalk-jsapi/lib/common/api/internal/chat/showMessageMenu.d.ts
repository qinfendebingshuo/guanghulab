export declare const apiName = "internal.chat.showMessageMenu";
/**
 * 弹出消息菜单 请求参数定义
 * @apiName internal.chat.showMessageMenu
 */
export interface IInternalChatShowMessageMenuParams {
    /** 所在的会话id */
    cid: string;
    /** 对应的消息id */
    mid: number;
    /** 消息按钮相对屏幕x轴偏移 */
    xoffset: number;
    /** 消息组件y轴偏移 */
    yoffset: number;
    /** 消息组件按钮宽度 */
    width: number;
    /** 消息组件按钮高度 */
    height: number;
    /** 白名单，如果传了值，个数>0，则只考虑白名单内的选项 */
    whiteList?: number;
    /** 禁掉表情，true则不显示表情，false则显示 */
    disableEmotion?: boolean;
}
/**
 * 弹出消息菜单 返回结果定义
 * @apiName internal.chat.showMessageMenu
 */
export interface IInternalChatShowMessageMenuResult {
}
/**
 * 弹出消息菜单
 * @apiName internal.chat.showMessageMenu
 * @supportVersion ios: 4.7.5 android: 4.7.5
 */
export declare function showMessageMenu$(params: IInternalChatShowMessageMenuParams): Promise<IInternalChatShowMessageMenuResult>;
export default showMessageMenu$;
