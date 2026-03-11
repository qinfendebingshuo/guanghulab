export declare const apiName = "internal.notify.closeModal";
/**
 * 关闭全屏浮层弹框，全屏遮罩 请求参数定义
 * @apiName internal.notify.closeModal
 */
export interface IInternalNotifyCloseModalParams {
    [key: string]: any;
}
/**
 * 关闭全屏浮层弹框，全屏遮罩 返回结果定义
 * @apiName internal.notify.closeModal
 */
export interface IInternalNotifyCloseModalResult {
    [key: string]: any;
}
/**
 * 关闭全屏浮层弹框，全屏遮罩
 * @apiName internal.notify.closeModal
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function closeModal$(params: IInternalNotifyCloseModalParams): Promise<IInternalNotifyCloseModalResult>;
export default closeModal$;
