import { ICommonAPIParams } from '../../constant/types';
/**
 * 发送翻译通知 请求参数定义
 * @apiName notifyTranslateEvent
 */
export interface IUnionNotifyTranslateEventParams extends ICommonAPIParams {
    token: string;
    pageId: string;
    bizName?: string;
    eventName: string;
}
/**
 * 发送翻译通知 返回结果定义
 * @apiName notifyTranslateEvent
 */
export interface IUnionNotifyTranslateEventResult {
}
/**
 * 发送翻译通知
 * @apiName notifyTranslateEvent
 */
export declare function notifyTranslateEvent$(params: IUnionNotifyTranslateEventParams): Promise<IUnionNotifyTranslateEventResult>;
export default notifyTranslateEvent$;
