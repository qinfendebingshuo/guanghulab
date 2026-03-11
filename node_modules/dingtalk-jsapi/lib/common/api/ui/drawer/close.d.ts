export declare const apiName = "ui.drawer.close";
/**
 *  请求参数定义
 * @apiName ui.drawer.close
 */
export interface IUiDrawerCloseParams {
    [key: string]: any;
}
/**
 *  返回结果定义
 * @apiName ui.drawer.close
 */
export interface IUiDrawerCloseResult {
    [key: string]: any;
}
/**
 *
 * @apiName ui.drawer.close
 * @supportVersion  ios: 2.6.0 android: 2.6.0
 */
export declare function close$(params: IUiDrawerCloseParams): Promise<IUiDrawerCloseResult>;
export default close$;
