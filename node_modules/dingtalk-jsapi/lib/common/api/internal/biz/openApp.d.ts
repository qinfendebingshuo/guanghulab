export declare const apiName = "internal.biz.openApp";
/**
 * PC端打开相应app 请求参数定义
 * @apiName internal.biz.openApp
 */
export interface IInternalBizOpenAppParams {
    [key: string]: any;
}
/**
 * PC端打开相应app 返回结果定义
 * @apiName internal.biz.openApp
 */
export interface IInternalBizOpenAppResult {
    [key: string]: any;
}
/**
 * PC端打开相应app
 * @apiName internal.biz.openApp
 * @supportVersion  pc: 3.4.0
 */
export declare function openApp$(params: IInternalBizOpenAppParams): Promise<IInternalBizOpenAppResult>;
export default openApp$;
