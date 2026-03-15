export declare const apiName = "internal.contact.openSelectUserWnd";
/**
 * 调起通用选人组件(PC) 请求参数定义
 * @apiName internal.contact.openSelectUserWnd
 */
export interface IInternalContactOpenSelectUserWndParams {
    title: string;
    param: any;
}
/**
 * 调起通用选人组件(PC) 返回结果定义
 * @apiName internal.contact.openSelectUserWnd
 */
export interface IInternalContactOpenSelectUserWndResult {
    [key: string]: any;
}
/**
 * 调起通用选人组件(PC)
 * @apiName internal.contact.openSelectUserWnd
 * @supportVersion pc: 4.6.18
 */
export declare function openSelectUserWnd$(params: IInternalContactOpenSelectUserWndParams): Promise<IInternalContactOpenSelectUserWndResult>;
export default openSelectUserWnd$;
