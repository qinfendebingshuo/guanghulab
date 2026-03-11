export declare const apiName = "internal.attend.assistant";
/**
 * 上班助手 请求参数定义
 * @apiName internal.attend.assistant
 */
export interface IInternalAttendAssistantParams {
    [key: string]: any;
}
/**
 * 上班助手 返回结果定义
 * @apiName internal.attend.assistant
 */
export interface IInternalAttendAssistantResult {
    [key: string]: any;
}
/**
 * 上班助手
 * @apiName internal.attend.assistant
 * @supportVersion  ios: 2.11.0 android: 2.11.0
 */
export declare function assistant$(params: IInternalAttendAssistantParams): Promise<IInternalAttendAssistantResult>;
export default assistant$;
