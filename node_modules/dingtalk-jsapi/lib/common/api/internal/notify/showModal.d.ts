export declare const apiName = "internal.notify.showModal";
/**
 * 全屏浮层弹框，全屏遮罩 请求参数定义
 * @apiName internal.notify.showModal
 */
export interface IInternalNotifyShowModalParams {
    [key: string]: any;
}
/**
 * 全屏浮层弹框，全屏遮罩 返回结果定义
 * @apiName internal.notify.showModal
 */
export interface IInternalNotifyShowModalResult {
    [key: string]: any;
}
/**
 * 全屏浮层弹框，全屏遮罩
 * @apiName internal.notify.showModal
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function showModal$(params: IInternalNotifyShowModalParams): Promise<IInternalNotifyShowModalResult>;
export default showModal$;
