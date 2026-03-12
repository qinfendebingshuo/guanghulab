export declare const apiName = "ui.nav.quit";
/**
 *  请求参数定义
 * @apiName ui.nav.quit
 */
export interface IUiNavQuitParams {
    [key: string]: any;
}
/**
 *  返回结果定义
 * @apiName ui.nav.quit
 */
export interface IUiNavQuitResult {
    [key: string]: any;
}
/**
 *
 * @apiName ui.nav.quit
 * @supportVersion  ios: 2.10.0 android: 2.11.0
 */
export declare function quit$(params: IUiNavQuitParams): Promise<IUiNavQuitResult>;
export default quit$;
