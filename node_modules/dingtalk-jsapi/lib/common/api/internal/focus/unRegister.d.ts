export declare const apiName = "internal.focus.unRegister";
/**
 * 投屏事件取消注册 请求参数定义
 * @apiName internal.focus.unRegister
 */
export interface IInternalFocusUnRegisterParams {
}
/**
 * 投屏事件取消注册 返回结果定义
 * @apiName internal.focus.unRegister
 */
export interface IInternalFocusUnRegisterResult {
}
/**
 * 投屏事件取消注册
 * @apiName internal.focus.unRegister
 * @supportVersion android: 4.7.23
 * @author android: 柳樵, ios: 见招
 */
export declare function unRegister$(params: IInternalFocusUnRegisterParams): Promise<IInternalFocusUnRegisterResult>;
export default unRegister$;
