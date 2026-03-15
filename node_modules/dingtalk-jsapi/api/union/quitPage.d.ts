import { ICommonAPIParams } from '../../constant/types';
/**
 * PC端关闭页面 请求参数定义
 * @apiName quitPage
 */
export interface IUnionQuitPageParams extends ICommonAPIParams {
}
/**
 * PC端关闭页面 返回结果定义
 * @apiName quitPage
 */
export interface IUnionQuitPageResult {
}
/**
 * PC端关闭页面
 * @apiName quitPage
 */
export declare function quitPage$(params: IUnionQuitPageParams): Promise<IUnionQuitPageResult>;
export default quitPage$;
