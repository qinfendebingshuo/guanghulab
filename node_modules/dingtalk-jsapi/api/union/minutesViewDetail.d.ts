import { ICommonAPIParams } from '../../constant/types';
/**
 * 跳转到闪记的详情页面 请求参数定义
 * @apiName minutesViewDetail
 */
export interface IUnionMinutesViewDetailParams extends ICommonAPIParams {
    uuid: string;
}
/**
 * 跳转到闪记的详情页面 返回结果定义
 * @apiName minutesViewDetail
 */
export interface IUnionMinutesViewDetailResult {
}
/**
 * 跳转到闪记的详情页面
 * @apiName minutesViewDetail
 */
export declare function minutesViewDetail$(params: IUnionMinutesViewDetailParams): Promise<IUnionMinutesViewDetailResult>;
export default minutesViewDetail$;
