import { ICommonAPIParams } from '../../constant/types';
/**
 * 返回上一个应用 请求参数定义
 * @apiName navigateBackPage
 */
export interface IUnionNavigateBackPageParams extends ICommonAPIParams {
    extraData: {};
}
/**
 * 返回上一个应用 返回结果定义
 * @apiName navigateBackPage
 */
export interface IUnionNavigateBackPageResult {
}
/**
 * 返回上一个应用
 * @apiName navigateBackPage
 */
export declare function navigateBackPage$(params: IUnionNavigateBackPageParams): Promise<IUnionNavigateBackPageResult>;
export default navigateBackPage$;
