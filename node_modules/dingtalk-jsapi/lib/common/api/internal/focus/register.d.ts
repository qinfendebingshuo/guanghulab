export declare const apiName = "internal.focus.register";
/**
 * 投屏事件注册 请求参数定义
 * @apiName internal.focus.register
 */
export interface IInternalFocusRegisterParams {
}
/**
 * 投屏事件注册 返回结果定义
 * @apiName internal.focus.register
 */
export interface IInternalFocusRegisterResult {
}
/**
 * 投屏事件注册
 * @apiName internal.focus.register
 * @supportVersion android: 4.7.23
 * @author android: 柳樵, ios: 见招
 */
export declare function register$(params: IInternalFocusRegisterParams): Promise<IInternalFocusRegisterResult>;
export default register$;
