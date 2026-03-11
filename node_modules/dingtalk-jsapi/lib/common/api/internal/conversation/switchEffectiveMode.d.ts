export declare const apiName = "internal.conversation.switchEffectiveMode";
/**
 * 切换到专注模式开关 请求参数定义
 * @apiName internal.conversation.switchEffectiveMode
 */
export interface IInternalConversationSwitchEffectiveModeParams {
    /** 是否打开专注模式 */
    isOn?: boolean;
}
/**
 * 切换到专注模式开关 返回结果定义
 * @apiName internal.conversation.switchEffectiveMode
 */
export interface IInternalConversationSwitchEffectiveModeResult {
}
/**
 * 切换到专注模式开关
 * @apiName internal.conversation.switchEffectiveMode
 * @supportVersion ios: 5.1.41 android: 5.1.41
 * @author Android：彦海, iOS：济凡
 */
export declare function switchEffectiveMode$(params: IInternalConversationSwitchEffectiveModeParams): Promise<IInternalConversationSwitchEffectiveModeResult>;
export default switchEffectiveMode$;
